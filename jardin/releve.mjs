// Relève le calendrier de contributions d'un compte GitHub.
//
//   relever({ pseudo, jeton })  → { jours, total, releve, source }
//   `jours` : [{ date: 'AAAA-MM-JJ', niveau: 0..4, nombre }] triés, un par jour, comme dans releve-exemple.json
//
// Avec un jeton : l'API GraphQL de GitHub (contributionsCollection.contributionCalendar). Sans jeton, ou si
// l'API échoue : la page publique https://github.com/users/<pseudo>/contributions, celle que le profil affiche.
// Un relevé vide, troué ou trop court pour être une année est une erreur : relever() lève, et rien n'est rendu.
// Aucune dépendance : Node nu (fetch est fourni par Node 18 et suivants).

const API = 'https://api.github.com/graphql';
const NAVIGATEUR = 'jardin (README de profil ; https://github.com)';
const DELAI = 20_000;
const UN_JOUR = 86_400_000;

const REQUETE = `query ($pseudo: String!) {
	user(login: $pseudo) {
		contributionsCollection {
			contributionCalendar {
				totalContributions
				weeks { contributionDays { date contributionCount contributionLevel } }
			}
		}
	}
}`;
const NIVEAUX = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

/**
 * Vérifie un relevé et le rend trié : des dates valides, qui se suivent sans trou ni doublon, des niveaux de 0
 * à 4, des nombres entiers. `annee` : exiger en plus la longueur d'une année (ce que GitHub rend toujours).
 */
export function controler(jours, { annee = false } = {}) {
	if (!Array.isArray(jours) || jours.length === 0) throw new Error('le relevé est vide');
	const tries = jours.map((jour) => ({ date: jour?.date, niveau: jour?.niveau, nombre: jour?.nombre })).sort((a, b) => (String(a.date) < String(b.date) ? -1 : 1));
	tries.forEach((jour, k) => {
		const temps = /^\d{4}-\d{2}-\d{2}$/.test(jour.date) ? Date.parse(jour.date + 'T00:00:00Z') : NaN;
		// Une date impossible (un 30 février) est reportée par Date.parse sur le mois suivant au lieu d'être refusée :
		// on exige que la date relue soit celle qui a été écrite.
		if (Number.isNaN(temps) || new Date(temps).toISOString().slice(0, 10) !== jour.date) throw new Error(`date illisible : ${JSON.stringify(jour.date)}`);
		if (!Number.isInteger(jour.niveau) || jour.niveau < 0 || jour.niveau > 4) throw new Error(`niveau illisible le ${jour.date} : ${JSON.stringify(jour.niveau)}`);
		if (!Number.isInteger(jour.nombre) || jour.nombre < 0) throw new Error(`nombre illisible le ${jour.date} : ${JSON.stringify(jour.nombre)}`);
		if (k > 0 && temps - Date.parse(tries[k - 1].date + 'T00:00:00Z') !== UN_JOUR) throw new Error(`les jours ne se suivent pas entre le ${tries[k - 1].date} et le ${jour.date}`);
	});
	if (annee && (tries.length < 357 || tries.length > 372)) throw new Error(`${tries.length} jours relevés : ce n'est pas une année`);
	return tries;
}

/** La réponse de l'API GraphQL → les jours. */
export function lireLApi(reponse) {
	if (reponse?.errors?.length) throw new Error(reponse.errors.map((erreur) => erreur.message).join(' ; '));
	const calendrier = reponse?.data?.user?.contributionsCollection?.contributionCalendar;
	if (!calendrier) throw new Error('la réponse ne contient pas de calendrier (compte introuvable ?)');
	return calendrier.weeks.flatMap((semaine) =>
		semaine.contributionDays.map((jour) => {
			if (!(jour.contributionLevel in NIVEAUX)) throw new Error(`niveau inconnu : ${jour.contributionLevel}`);
			return { date: jour.date, niveau: NIVEAUX[jour.contributionLevel], nombre: jour.contributionCount };
		}),
	);
}

/**
 * La page publique → les jours. Chaque jour y est une cellule <td data-date data-level id>, et son nombre de
 * contributions est dans la bulle <tool-tip for="cet id"> (« 9 contributions on October 7th. », « No contributions… »).
 */
export function lireLaPage(html) {
	const nombres = new Map();
	for (const [, attributs, texte] of html.matchAll(/<tool-tip\b([^>]*)>([^<]*)<\/tool-tip>/g)) {
		const pour = /\bfor="([^"]+)"/.exec(attributs)?.[1];
		if (!pour) continue;
		const lu = /^\s*(No|[\d,]+)\s+contributions?\b/.exec(texte);
		if (lu) nombres.set(pour, lu[1] === 'No' ? 0 : Number(lu[1].replaceAll(',', '')));
	}
	const jours = [];
	for (const [balise] of html.matchAll(/<td\b[^>]*\bdata-date="[^"]*"[^>]*>/g)) {
		const date = /\bdata-date="([^"]*)"/.exec(balise)[1];
		const niveau = Number(/\bdata-level="(\d+)"/.exec(balise)?.[1] ?? NaN);
		const id = /\bid="([^"]+)"/.exec(balise)?.[1];
		// Un jour sans bulle : zéro s'il est au niveau 0 ; sinon le nombre est inconnu, et le relevé est refusé.
		const nombre = nombres.get(id) ?? (niveau === 0 ? 0 : NaN);
		jours.push({ date, niveau, nombre });
	}
	if (!jours.length) throw new Error('aucun jour dans la page (GitHub a peut-être changé sa mise en forme)');
	return jours;
}

async function parLApi(pseudo, jeton) {
	const reponse = await fetch(API, {
		method: 'POST',
		headers: { Authorization: `bearer ${jeton}`, 'Content-Type': 'application/json', 'User-Agent': NAVIGATEUR },
		body: JSON.stringify({ query: REQUETE, variables: { pseudo } }),
		signal: AbortSignal.timeout(DELAI),
	});
	if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
	return lireLApi(await reponse.json());
}

async function parLaPage(pseudo) {
	const reponse = await fetch(`https://github.com/users/${pseudo}/contributions`, {
		headers: { Accept: 'text/html', 'User-Agent': NAVIGATEUR },
		signal: AbortSignal.timeout(DELAI),
	});
	if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
	return lireLaPage(await reponse.text());
}

/**
 * Relève le calendrier de `pseudo`. `jeton` : un jeton GitHub (celui de l'Action suffit) ; sans lui, la page
 * publique. `journal` reçoit une ligne par étape. Lève si aucune des deux sources ne donne une année valide.
 */
export async function relever({ pseudo, jeton, journal = () => {} } = {}) {
	if (typeof pseudo !== 'string' || !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(pseudo)) throw new Error(`pseudo GitHub invalide : ${JSON.stringify(pseudo)}`);
	const sources = [];
	if (jeton) sources.push(['api', () => parLApi(pseudo, jeton)]);
	sources.push(['page', () => parLaPage(pseudo)]);
	const echecs = [];
	for (const [source, lire] of sources) {
		try {
			const jours = controler(await lire(), { annee: true });
			journal(`relevé par ${source === 'api' ? "l'API GraphQL" : 'la page publique'} : ${jours.length} jours, du ${jours[0].date} au ${jours.at(-1).date}`);
			return { releve: jours.at(-1).date, total: jours.reduce((somme, jour) => somme + jour.nombre, 0), jours, source };
		} catch (erreur) {
			echecs.push(`${source === 'api' ? 'API GraphQL' : 'page publique'} : ${erreur.message}`);
			journal(`échec (${echecs.at(-1)})`);
		}
	}
	throw new Error(`relevé impossible. ${echecs.join(' | ')}`);
}
