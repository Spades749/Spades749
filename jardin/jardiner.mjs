// La tâche quotidienne du jardin.
//
// Elle relève le calendrier de contributions, redessine les six images assets/jardin-*.svg et récrit, dans
// README.md, ce qui se trouve entre <!-- jardin:debut --> et <!-- jardin:fin --> (l'image et son texte
// alternatif, qui cite le total). Elle ne touche à rien d'autre. Un fichier n'est écrit que s'il change. Si
// le relevé échoue ou revient vide, ou si le README n'a pas ses deux marqueurs, elle s'arrête sans rien écrire
// (code de sortie 1). Elle ne fait aucun commit : c'est le workflow qui s'en charge.
//
// Usage, depuis la racine du dépôt :  node jardin/jardiner.mjs [options]
//   --releve <fichier.json>  lire le relevé dans un fichier ({ "jours": [...] }, comme releve-exemple.json)
//                            au lieu d'interroger GitHub : pour essayer sans réseau. Il doit couvrir une année,
//                            comme un relevé de GitHub
//   --court                  avec --releve : accepter un relevé plus court ou plus long qu'une année (essais du
//                            dessin sur des cas limites ; jamais dans le dépôt public)
//   --a-sec                  dire ce qui changerait, sans rien écrire
//   --pseudo <compte>        le compte à relever (par défaut : le propriétaire du dépôt, sinon Spades749)
//   --racine <dossier>       le dépôt à jardiner (par défaut : le dossier parent de jardin/)
// Le jeton de l'API est lu dans la variable GITHUB_TOKEN ; sans lui, c'est la page publique qui est lue.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FICHIERS, blocDuJardin, dessinerJardin, resumer } from './dessin.mjs';
import { controler, relever } from './releve.mjs';

const DEBUT = '<!-- jardin:debut -->';
const FIN = '<!-- jardin:fin -->';

const dire = (ligne) => console.log(`jardin : ${ligne}`);
/** S'arrêter sans avoir rien écrit. */
function renoncer(raison) {
	console.error(`jardin : ${raison}. Rien n'a été écrit.`);
	process.exit(1);
}

// --- Les options ---
const options = { racine: resolve(dirname(fileURLToPath(import.meta.url)), '..'), pseudo: process.env.GITHUB_REPOSITORY_OWNER || 'Spades749', aSec: false, court: false, releve: null };
{
	const arguments_ = process.argv.slice(2);
	for (let k = 0; k < arguments_.length; k++) {
		const nom = arguments_[k];
		if (nom === '--a-sec') options.aSec = true;
		else if (nom === '--court') options.court = true;
		else if (['--releve', '--pseudo', '--racine'].includes(nom) && arguments_[k + 1] !== undefined) options[nom.slice(2)] = arguments_[++k];
		else renoncer(`option inconnue ou incomplète : ${nom} (voir l'en-tête de jardin/jardiner.mjs)`);
	}
	options.racine = resolve(options.racine);
}

// --- Le relevé ---
let jours;
try {
	if (options.releve) {
		const lu = JSON.parse(readFileSync(options.releve, 'utf8'));
		jours = controler(Array.isArray(lu) ? lu : lu.jours, { annee: !options.court });
		dire(`relevé lu dans ${options.releve} : ${jours.length} jours, du ${jours[0].date} au ${jours.at(-1).date}`);
	} else {
		({ jours } = await relever({ pseudo: options.pseudo, jeton: process.env.GITHUB_TOKEN, journal: dire }));
	}
} catch (erreur) {
	renoncer(erreur.message);
}

// --- Le README et ses deux marqueurs ---
const cheminDuReadme = join(options.racine, 'README.md');
if (!existsSync(cheminDuReadme)) renoncer(`pas de README.md dans ${options.racine}`);
const readme = readFileSync(cheminDuReadme, 'utf8');
const debut = readme.indexOf(DEBUT);
const fin = readme.indexOf(FIN);
if (debut === -1 || fin === -1 || fin < debut || readme.indexOf(DEBUT, debut + 1) !== -1 || readme.indexOf(FIN, fin + 1) !== -1) {
	renoncer(`README.md doit contenir une fois ${DEBUT} puis une fois ${FIN}`);
}

// --- Ce qui doit être écrit : tout est calculé avant la première écriture ---
const cibles = [];
try {
	for (const { nom, theme, forme } of FICHIERS) cibles.push({ chemin: join(options.racine, 'assets', nom), nom: `assets/${nom}`, contenu: dessinerJardin({ jours, theme, forme }) });
	// Seul l'intérieur des marqueurs est remplacé ; les blancs qui l'entourent sont gardés tels quels. Entre deux
	// marqueurs vides, un seul saut de ligne de chaque côté (celui du README, LF ou CRLF), quoi qu'on y ait laissé :
	// c'est ce qu'écrit le générateur du profil, et la tâche redonne ainsi son README à l'octet près.
	const interieur = readme.slice(debut + DEBUT.length, fin);
	const vide = interieur.trim() === '';
	const saut = /\r?\n/.exec(readme)?.[0] ?? '\n';
	const avant = vide ? saut : /^\s*/.exec(interieur)[0];
	const apres = vide ? saut : /\s*$/.exec(interieur)[0];
	cibles.push({ chemin: cheminDuReadme, nom: 'README.md', contenu: readme.slice(0, debut + DEBUT.length) + avant + blocDuJardin({ jours }) + apres + readme.slice(fin) });
} catch (erreur) {
	renoncer(`le dessin a échoué (${erreur.message})`);
}

const { total, actifs, jours: nombre } = resumer(jours);
dire(`${total} contribution${total > 1 ? 's' : ''}, ${actifs} jour${actifs > 1 ? 's' : ''} actif${actifs > 1 ? 's' : ''} sur ${nombre}`);

// --- L'écriture : seulement ce qui change ---
const changes = cibles.filter(({ chemin, contenu }) => !existsSync(chemin) || readFileSync(chemin, 'utf8') !== contenu);
if (!changes.length) {
	dire("rien n'a changé.");
} else if (options.aSec) {
	for (const { nom, chemin } of changes) dire(`à sec : ${nom} ${existsSync(chemin) ? 'serait récrit' : 'serait créé'}`);
} else {
	mkdirSync(join(options.racine, 'assets'), { recursive: true });
	for (const { nom, chemin, contenu } of changes) {
		writeFileSync(chemin, contenu);
		dire(`${nom} écrit`);
	}
}
