// Le jardin à la française vu en plan : son tapis vert est le calendrier de contributions GitHub.
//
//   dessinerJardin({ jours, theme, forme })  → le texte d'un SVG (theme 'jour' | 'soir', forme 'large' | 'moyen' | 'etroit')
//   blocDuJardin({ jours })                  → le fragment du README : <p align="center"><picture>…</picture></p>
//   `jours` : [{ date: 'AAAA-MM-JJ', niveau: 0..4, nombre }] triés, comme dans releve-exemple.json (.jours)
//
// Ce module n'importe rien hors de son dossier et de node: (la tâche quotidienne tourne sur Node nu). Ses textes
// sont composés avec glyphes.json, tracé une fois dans la police du site par profil/tracer-glyphes.mjs.
// Même entrée, mêmes octets en sortie : ni date du jour, ni hasard, ni mise en forme dépendante de la machine.
//
// Comment il se lit. Une plate-bande par jour, rangées par semaines (une colonne par semaine, le dimanche en
// haut, comme sur GitHub), une allée entre deux mois, les mois en chiffres romains. Une semaine à cheval sur deux
// mois reste d'un bloc, rangée avec le mois de son dimanche : c'est la convention de GitHub. Cinq états, ceux de
// GitHub : plate-bande nue (le sable de l'allée), arbuste, buis fleuri, massif d'or, massif de Rance ; le soir,
// du gazon éteint au lampion le plus vif. Le cartouche donne le total, l'échelle (le plus petit nombre relevé à chaque niveau) et les
// années. Tout le reste (bosquets, broderies, bassins, ifs, vases, arbres) est l'architecture du jardin et ne
// dépend pas des données.
//
// Trois compositions, chacune montrée à sa largeur propre (le README ne lui donne pas de largeur : elle ne peut
// que rétrécir, jamais s'agrandir). Large, 829 px : les deux moitiés de l'année de part et d'autre du bassin
// central, le long du grand axe. Moyenne, 556 px : le même plan réduit aux deux tiers, ses textes agrandis
// d'autant pour rester à leur corps. Étroite, 318 px et lisible à 278 : les deux moitiés l'une sous l'autre, de
// part et d'autre du même bassin.
//
// Rien n'est peint de la couleur de la page : le fond est transparent, les allées sont la page elle-même.
import { readFileSync } from 'node:fs';

const GLYPHES = JSON.parse(readFileSync(new URL('./glyphes.json', import.meta.url), 'utf8'));

export const THEMES = ['jour', 'soir'];
export const FORMES = ['large', 'moyen', 'etroit'];
/** Les six fichiers du jardin, tels que le README les appelle (dossier assets/ du dépôt). */
export const FICHIERS = FORMES.flatMap((forme) => THEMES.map((theme) => ({ forme, theme, nom: `jardin-${forme}-${theme}.svg` })));
/**
 * Les fenêtres de chaque composition, [largeur minimale, largeur maximale] en pixels (null : borne ouverte),
 * d'après la colonne du README mesurée sur github.com. Ce sont celles des blocs de texte du profil :
 *   étroite  colonne de moins de 530 px (fenêtres de moins de 600 px, et de 768 à 899 px) ;
 *   moyenne  colonne de 513 à 711 px ;
 *   large    colonne d'au moins 695 px.
 */
export const FENETRES = { etroit: [[null, 599], [768, 899]], moyen: [[600, 767], [900, 1145]], large: [[1146, null]] };
/** La largeur propre de chaque composition, en pixels. */
export const LARGEURS = { large: 829, moyen: 556, etroit: 318 };

const n1 = (v) => Number(v.toFixed(1));
const n2 = (v) => Number(v.toFixed(2));
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ Les données

const CHIFFRES = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
/** 2026 → « MMXXVI ». */
function romain(nombre) {
	let reste = nombre;
	let resultat = '';
	for (const [valeur, symbole] of CHIFFRES) while (reste >= valeur) (resultat += symbole), (reste -= valeur);
	return resultat;
}

/** 1002 → « 1 002 » avec le séparateur voulu (écrit à la main : toLocaleString dépend de la machine). */
const milliers = (nombre, separateur) => String(nombre).replace(/\B(?=(\d{3})+$)/g, separateur);

const rangDuJour = (date) => new Date(date + 'T00:00:00Z').getUTCDay();

/** Les jours valides, triés, sans doublon. */
function nettoyer(jours) {
	if (!Array.isArray(jours)) throw new TypeError('jours : un tableau est attendu.');
	const parDate = new Map();
	for (const jour of jours) {
		if (!jour || !/^\d{4}-\d{2}-\d{2}$/.test(jour.date) || Number.isNaN(rangDuJour(jour.date))) continue;
		const nombre = Math.max(0, Math.round(Number(jour.nombre) || 0));
		const niveau = Math.min(4, Math.max(0, Math.round(Number(jour.niveau) || 0)));
		parDate.set(jour.date, { date: jour.date, niveau, nombre });
	}
	const propres = [...parDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
	if (!propres.length) throw new Error('jours : aucun jour à dessiner.');
	return propres;
}

/** Les jours rangés par semaines (colonnes du dimanche au samedi), comme sur GitHub. `rang` : 0 pour dimanche. */
function semaines(jours) {
	const colonnes = [];
	for (const jour of jours) {
		const rang = rangDuJour(jour.date);
		if (rang === 0 || colonnes.length === 0) colonnes.push([]);
		colonnes.at(-1).push({ ...jour, rang });
	}
	return colonnes;
}

/** Ce que le calendrier dit en chiffres. */
export function resumer(jours) {
	const propres = nettoyer(jours);
	return {
		total: propres.reduce((somme, jour) => somme + jour.nombre, 0),
		actifs: propres.filter((jour) => jour.nombre > 0).length,
		jours: propres.length,
		debut: propres[0].date,
		fin: propres.at(-1).date,
	};
}

// ------------------------------------------------------------------ Les couleurs

// Le jour : les matières du site. Vert Campan pour tout ce qui pousse, turquin et azur pour l'eau, ivoire pour
// le sable et la pierre, or en filets, rouge de Rance pour les fleurs. Le soir : le jardin illuminé.
const PALETTES = {
	jour: {
		trait: '#17245c',
		ombre: 'rgba(46,34,16,.17)',
		// Les cinq états d'une plate-bande : le sable nu d'une allée (l'ivoire du site, cerné d'un filet), un Campan
		// clair pour l'arbuste, puis le buis fleuri, le massif d'or, le massif de Rance.
		gazon: ['#f2eee4', '#86aa93', '#42654d', '#ecd596', '#8c4332'],
		bord: ['#cfc3a3', '#5d846b', '#2d4f37', '#8f6f27', '#5f2a1e'],
		massif: '#42654d',
		grain: '#2d4f37',
		eclat: '#6b8d75',
		lisiere: '#2d4f37',
		buis: '#2d4f37',
		if: '#2d4f37',
		sable: '#f2eee4',
		eau: ['#3d4f93', '#17245c'],
		onde: '#f2eee4',
		margelle: '#f2eee4',
		filet: '#8f6f27',
		or: '#c9a24b',
		orClair: '#ecd596',
		orSombre: '#8f6f27',
		rance: '#8c4332',
		arbre: '#587b63',
		reflet: '#dfe9e0',
		soleil: '#ecd596',
		texte: '#8f6f27',
		texteDoux: '#3b4474',
	},
	soir: {
		trait: '#c9a24b',
		ombre: 'rgba(0,1,12,.5)',
		gazon: ['#101d18', '#183226', '#21442f', '#4a3d19', '#7a531d'],
		bord: ['#1f382d', '#2f5a47', '#3f7558', '#a8894a', '#ecd596'],
		massif: '#11231b',
		grain: '#1a3528',
		eclat: '#234536',
		lisiere: '#35594a',
		buis: '#a98c4c',
		if: '#1c3a2c',
		sable: 'rgba(201,162,75,.05)',
		eau: ['#22388f', '#0f1947'],
		onde: '#f6e7b8',
		margelle: '#1b2030',
		filet: '#c9a24b',
		or: '#c9a24b',
		orClair: '#ecd596',
		orSombre: '#8f6f27',
		rance: '#b65f45',
		arbre: '#16291f',
		reflet: '#234536',
		soleil: '#ecd596',
		texte: '#c9a24b',
		texteDoux: '#c9c0a8',
	},
};

// ------------------------------------------------------------------ Le texte

const THOUSANDS = ' '; // espace fine insécable : le séparateur des milliers dans l'image

/**
 * Un encrier par image : chaque glyphe employé est défini une fois (dans <defs>, en unités de la police) puis
 * reposé par <use>. ecrire(chaine, { x, y, ancre, taille, graisse, espacement, fill }) ; mesurer(chaine, options).
 */
function encrier() {
	const ids = new Map();
	const chemins = [];
	const em = GLYPHES.em;

	function composer(chaine, { taille = 10, graisse = 500, espacement = 0 } = {}, enregistrer = true) {
		const police = GLYPHES.graisses[graisse];
		if (!police) throw new Error(`glyphes.json : pas de graisse ${graisse}.`);
		const signes = [...chaine];
		const interlettre = espacement * em;
		let plume = 0;
		const poses = [];
		signes.forEach((signe, k) => {
			if (signe === THOUSANDS) {
				plume += 0.09 * em + interlettre;
				return;
			}
			const glyphe = police.signes[signe];
			if (!glyphe) throw new Error(`glyphes.json : le signe « ${signe} » manque (relancer profil/tracer-glyphes.mjs).`);
			if (glyphe.d && enregistrer) {
				const cle = `${graisse}:${signe}`;
				if (!ids.has(cle)) {
					const id = 'g' + ids.size.toString(36);
					ids.set(cle, id);
					chemins.push(`<path id="${id}" d="${glyphe.d}"/>`);
				}
				poses.push([ids.get(cle), plume]);
			}
			const suivant = signes[k + 1];
			plume += glyphe.avance + (suivant ? (police.crenage[signe + suivant] ?? 0) : 0) + interlettre;
		});
		const e = taille / em;
		return { poses, e, largeur: Math.max(0, plume - interlettre) * e, capitale: police.capitale * e };
	}

	function ecrire(chaine, { x = 0, y = 0, ancre = 'start', fill = 'currentColor', ...options } = {}) {
		const { poses, e, largeur } = composer(chaine, options);
		const dx = ancre === 'middle' ? x - largeur / 2 : ancre === 'end' ? x - largeur : x;
		return `<g transform="translate(${n2(dx)} ${n2(y)}) scale(${Number(e.toFixed(5))})" fill="${fill}">${poses.map(([id, px]) => `<use href="#${id}"${px ? ` x="${px}"` : ''}/>`).join('')}</g>`;
	}

	return {
		ecrire,
		mesurer: (chaine, options) => composer(chaine, options, false).largeur,
		capitale: (options) => composer('', options, false).capitale,
		defs: () => chemins.join(''),
	};
}

// ------------------------------------------------------------------ Les ornements

/** Le soleil du site : un cercle et seize rayons, un long, un court. */
function soleil({ cx = 0, cy = 0, r = 12, couleur, epaisseur = 1 }) {
	const e = r / 12;
	const rayons = Array.from({ length: 16 }, (_, i) => {
		const angle = (i * Math.PI) / 8;
		const [debut, fin] = i % 2 === 0 ? [6.2, 11] : [6.2, 8.8];
		return `M${n1(cx + Math.cos(angle) * debut * e)} ${n1(cy + Math.sin(angle) * debut * e)}L${n1(cx + Math.cos(angle) * fin * e)} ${n1(cy + Math.sin(angle) * fin * e)}`;
	});
	return `<g fill="none" stroke="${couleur}" stroke-width="${epaisseur}" stroke-linecap="round"><circle cx="${n1(cx)}" cy="${n1(cy)}" r="${n1(3.6 * e)}"/><path d="${rayons.join('')}"/></g>`;
}

// --- Les rinceaux d'un quart de parterre de broderie (origine au centre du parterre, vers +x et +y). ---
function spirale(cx, cy, rayon, depart, sens, tours) {
	const pas = Math.ceil(tours * 22);
	const points = [];
	for (let k = 0; k <= pas; k++) {
		const t = k / pas;
		const angle = depart + sens * TAU * tours * t;
		const r = rayon * (1 - 0.9 * t ** 0.9);
		points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
	}
	return points;
}
/** Une tige qui part de (x0, y0) dans la direction a0 et s'enroule en volute autour de (cx, cy). */
function volute({ x0, y0, a0, cx, cy, rayon, depart, sens, tours = 1.35, tension = 0.45 }) {
	const points = spirale(cx, cy, rayon, depart, sens, tours);
	const [sx, sy] = points[0];
	const tangente = depart + (sens * Math.PI) / 2;
	const portee = Math.hypot(sx - x0, sy - y0) * tension;
	const c1 = [x0 + Math.cos(a0) * portee, y0 + Math.sin(a0) * portee];
	const c2 = [sx - Math.cos(tangente) * portee, sy - Math.sin(tangente) * portee];
	return {
		d: `M${n1(x0)} ${n1(y0)}C${n1(c1[0])} ${n1(c1[1])} ${n1(c2[0])} ${n1(c2[1])} ${n1(sx)} ${n1(sy)}${points.slice(1).map(([x, y]) => `L${n1(x)} ${n1(y)}`).join('')}`,
		bouton: points.at(-1),
	};
}
/** Une feuille en amande : base (x, y), direction a, longueur l, largeur w. */
function feuille(x, y, a, l, w) {
	const [dx, dy] = [Math.cos(a), Math.sin(a)];
	const [nx, ny] = [-dy, dx];
	const p = (t, s) => `${n1(x + dx * l * t + nx * w * s)} ${n1(y + dy * l * t + ny * w * s)}`;
	return `M${p(0, 0)}C${p(0.25, 1)} ${p(0.6, 0.9)} ${p(1, 0)}C${p(0.6, -0.9)} ${p(0.25, -1)} ${p(0, 0)}Z`;
}
/** Le quart d'une broderie de demi-côtés (qx, qy) : `k` est son échelle (1 pour un quart de 47,5 de côté). */
function quartDeBroderie(qx, qy) {
	const k = Math.min(1.08, Math.min(qx, qy) / 47.5);
	const tiges = [];
	const boutons = [];
	const feuilles = [];
	const ajouter = (v) => {
		const { d, bouton } = volute(v);
		tiges.push(d);
		boutons.push(bouton);
	};
	const r0 = 13 * Math.min(1, k * 1.15); // le rayon d'où partent les tiges, autour du bassin
	if (k > 0.62) {
		// La grande volute d'angle, portée par une tige qui sort du bassin.
		ajouter({ x0: r0 * 0.94, y0: r0 * 0.42, a0: 0.25, cx: qx - 13.5 * k - 1, cy: qy - 12.5 * k - 1, rayon: 11 * k, depart: -2.2, sens: 1, tours: 1.5 });
		// La volute du grand axe, enroulée vers l'intérieur.
		ajouter({ x0: r0 * 1.02, y0: 2.2, a0: -0.05, cx: qx - 11 * k, cy: 9.2 * k, rayon: 7.2 * k, depart: 2.5, sens: -1, tours: 1.3, tension: 0.5 });
		// La volute du petit axe.
		ajouter({ x0: r0 * 0.42, y0: r0 * 0.94, a0: 1.4, cx: 11 * k, cy: qy - 10.5 * k, rayon: 7.6 * k, depart: -0.6, sens: 1, tours: 1.3, tension: 0.5 });
		// Une contre-volute greffée sur la tige d'angle.
		ajouter({ x0: qx * 0.44, y0: qy * 0.38, a0: 1.5, cx: qx * 0.45, cy: qy - 8.5 * k, rayon: 5.6 * k, depart: -1.2, sens: -1, tours: 1.2, tension: 0.4 });
		// Un parterre allongé reçoit une volute de plus, au milieu de la longueur.
		if (qx > qy * 1.6) ajouter({ x0: qx * 0.33, y0: 2.5, a0: 0.3, cx: qx * 0.6, cy: 9.5 * k, rayon: 6.2 * k, depart: 2.6, sens: -1, tours: 1.25, tension: 0.5 });
		if (qy > qx * 1.6) ajouter({ x0: 2.5, y0: qy * 0.33, a0: 1.3, cx: 9.5 * k, cy: qy * 0.6, rayon: 6.2 * k, depart: -1, sens: 1, tours: 1.25, tension: 0.5 });
		// Les fleurons au bout des deux axes (à cheval sur l'axe : le miroir fait l'autre moitié).
		feuilles.push(feuille(qx - 8.5 * k, 0, 0, 8 * k, 1.9 * k), feuille(qx - 8.5 * k, 0.4, 0.85, 5.6 * k, 1.5 * k));
		feuilles.push(feuille(0, qy - 8.5 * k, Math.PI / 2, 8 * k, 1.9 * k), feuille(0.4, qy - 8.5 * k, Math.PI / 2 - 0.85, 5.6 * k, 1.5 * k));
	} else {
		// Un petit parterre : deux volutes franches par quart et un fleuron sur chaque axe, rien de plus fin.
		const r = Math.min(qy * 0.36, qx * 0.3);
		ajouter({ x0: r0 * 0.9, y0: r0 * 0.44, a0: 0.2, cx: qx - r - 1.2, cy: qy - r - 1, rayon: r, depart: -2.3, sens: 1, tours: 1.3, tension: 0.5 });
		ajouter({ x0: r0 * 0.5, y0: r0 * 0.86, a0: 1.5, cx: qx * 0.42, cy: qy - r * 0.78 - 1, rayon: r * 0.72, depart: -0.5, sens: -1, tours: 1.15, tension: 0.5 });
		feuilles.push(feuille(qx - r * 1.5, 0, 0, r * 1.25, r * 0.3));
		feuilles.push(feuille(0, qy - r * 0.95, Math.PI / 2, r * 0.75, r * 0.26));
	}
	return { tiges: tiges.join(''), boutons, feuilles: feuilles.join(''), k, r0 };
}

// --- Les bosquets : des massifs de verdure séparés par des allées (étoile, labyrinthe, salle ronde, colonnade). ---
// Chaque massif est tracé pour lui-même, d'un contour fermé : ni masque ni découpe (une image animée est
// repeinte en entier à chaque image, et les masques en faisaient presque la moitié du coût), et rien n'est peint
// de la couleur de la page : les allées sont ce qui reste entre les massifs.
// h : le demi-côté du bosquet ; e : le retrait du contour (0 pour la lisière, quelques dixièmes pour le feuillage).
function massif(dessin, h, e) {
	const m = Math.max(0.62, h / 56); // les allées d'un petit bosquet restent des allées
	const S = h - e;
	const coin = Math.max(0.5, 2 - e); // l'arrondi des angles du bosquet
	const pieces = [];
	// Les symétries du carré : `quarts` quarts de tour, précédés ou non d'un miroir (qui inverse le sens des arcs).
	const repere = (quarts, miroir = false) => {
		const point = (x, y) => {
			if (miroir) y = -y;
			for (let k = 0; k < quarts; k++) [x, y] = [-y, x];
			return `${n2(x)} ${n2(y)}`;
		};
		return {
			M: (x, y) => 'M' + point(x, y),
			L: (x, y) => 'L' + point(x, y),
			A: (r, grand, sens, x, y) => `A${n2(r)} ${n2(r)} 0 ${grand} ${miroir ? 1 - sens : sens} ${point(x, y)}`,
		};
	};
	// Où le bord d'une allée de demi-largeur a, couchée sur l'axe des x, coupe le cercle de rayon r ; et de même
	// pour une allée en diagonale, dont le bord est la droite x − y = d.
	const surLAxe = (r, a) => [Math.sqrt(r * r - a * a), a];
	const surLaDiagonale = (r, d) => {
		const y = (-d + Math.sqrt(2 * r * r - d * d)) / 2;
		return [y + d, y];
	};

	if (dessin === 'etoile') {
		// Huit allées en étoile, un rond-point, une allée circulaire : seize massifs.
		const [a1, a2, a3] = [2.1 * m + e, 1.6 * m + e, 1.6 * m + e];
		const [r0, ri, ro] = [0.2 * h + e, 0.6 * h - a3, 0.6 * h + a3];
		const d = a2 * Math.SQRT2;
		for (let quarts = 0; quarts < 4; quarts++) {
			for (const miroir of [false, true]) {
				const t = repere(quarts, miroir);
				pieces.push(t.M(...surLAxe(ro, a1)) + t.L(S, a1) + t.L(S, S - d) + t.L(...surLaDiagonale(ro, d)) + t.A(ro, 0, 0, ...surLAxe(ro, a1)) + 'Z');
				pieces.push(t.M(...surLAxe(r0, a1)) + t.L(...surLAxe(ri, a1)) + t.A(ri, 0, 1, ...surLaDiagonale(ri, d)) + t.L(...surLaDiagonale(r0, d)) + t.A(r0, 0, 0, ...surLAxe(r0, a1)) + 'Z');
			}
		}
	} else if (dessin === 'salle') {
		// Une salle ronde au centre, une allée circulaire ponctuée de quatre cabinets, deux allées en croix.
		const [a1, a3] = [2.1 * m + e, 1.6 * m + e];
		const R = 0.74 * h;
		const [r1, ri, ro, rc] = [0.42 * h + e, R - a3, R + a3, 0.12 * h + e];
		// Les deux points où le cercle de rayon r (autour du centre) coupe le cabinet posé sur la diagonale, et de
		// quel côté du centre du cabinet ils tombent.
		const croiser = (r) => {
			const x = (R * R + r * r - rc * rc) / (2 * R);
			const y = Math.sqrt(r * r - x * x);
			return { avant: [(x + y) * Math.SQRT1_2, (x - y) * Math.SQRT1_2], apres: [(x - y) * Math.SQRT1_2, (x + y) * Math.SQRT1_2], enDeca: x < R };
		};
		const [dehors, dedans] = [croiser(ro), croiser(ri)];
		const [xo, xi, x1] = [surLAxe(ro, a1)[0], surLAxe(ri, a1)[0], surLAxe(r1, a1)[0]];
		for (let quarts = 0; quarts < 4; quarts++) {
			const t = repere(quarts);
			pieces.push(t.M(xo, a1) + t.L(S, a1) + t.L(S, S - coin) + t.A(coin, 0, 1, S - coin, S) + t.L(a1, S) + t.L(a1, xo) + t.A(ro, 0, 0, ...dehors.apres) + t.A(rc, dehors.enDeca ? 1 : 0, 0, ...dehors.avant) + t.A(ro, 0, 0, xo, a1) + 'Z');
			pieces.push(t.M(xi, a1) + t.A(ri, 0, 1, ...dedans.avant) + t.A(rc, dedans.enDeca ? 0 : 1, 0, ...dedans.apres) + t.A(ri, 0, 1, a1, xi) + t.L(a1, x1) + t.A(r1, 0, 0, x1, a1) + 'Z');
		}
	} else if (dessin === 'colonnade') {
		// Deux allées en diagonale, un grand rond, et deux courtes allées qui y mènent.
		const [a2, a3] = [1.8 * m + e, 1.5 * m + e];
		const r1 = 0.52 * h + e;
		const d = a2 * Math.SQRT2;
		const [x1, y1] = surLaDiagonale(r1, d);
		const [xa] = surLAxe(r1, a3);
		for (const quarts of [0, 2]) {
			const t = repere(quarts);
			pieces.push(t.M(x1, y1) + t.L(S, S - d) + t.L(S, d - S) + t.L(x1, -y1) + t.A(r1, 0, 1, x1, y1) + 'Z');
		}
		for (const quarts of [1, 3]) {
			for (const miroir of [false, true]) {
				const t = repere(quarts, miroir);
				pieces.push(t.M(xa, a3) + t.L(S, a3) + t.L(S, S - d) + t.L(x1, y1) + t.A(r1, 0, 0, xa, a3) + 'Z');
			}
		}
	} else {
		// Le labyrinthe : trois haies carrées emboîtées, ouvertes tour à tour, et un cabinet au centre.
		const w = 1.65 * m + e;
		const [a, b, c] = [h * 0.78, h * 0.53, h * 0.28];
		const r = 0.09 * h + e;
		const polygone = (...points) => 'M' + points.map(([x, y]) => `${n2(x)} ${n2(y)}`).join('L') + 'Z';
		const t = repere(0);
		const i1 = a + w;
		pieces.push(
			t.M(w, -S) + t.L(S - coin, -S) + t.A(coin, 0, 1, S, coin - S) + t.L(S, S - coin) + t.A(coin, 0, 1, S - coin, S) + t.L(coin - S, S) + t.A(coin, 0, 1, -S, S - coin) + t.L(-S, coin - S) + t.A(coin, 0, 1, coin - S, -S) +
				[[-w, -S], [-w, -i1], [-i1, -i1], [-i1, i1], [i1, i1], [i1, -i1], [w, -i1]].map(([x, y]) => t.L(x, y)).join('') +
				'Z',
		);
		const [o2, i2, g] = [a - w, b + w, -b / 2];
		pieces.push(polygone([o2, -w], [o2, -o2], [-o2, -o2], [-o2, g - w], [-i2, g - w], [-i2, -i2], [i2, -i2], [i2, -w]));
		pieces.push(polygone([o2, w], [o2, o2], [-o2, o2], [-o2, g + w], [-i2, g + w], [-i2, i2], [i2, i2], [i2, w]));
		const [o3, i3] = [b - w, c + w];
		pieces.push(polygone([w, o3], [o3, o3], [o3, -o3], [-o3, -o3], [-o3, o3], [-w, o3], [-w, i3], [-i3, i3], [-i3, -i3], [i3, -i3], [i3, i3], [w, i3]));
		const q = c - w;
		const x1 = Math.sqrt(r * r - w * w);
		pieces.push(t.M(-q, -q) + t.L(q, -q) + t.L(q, q) + t.L(-q, q) + t.L(-q, w) + t.L(-x1, w) + t.A(r, 1, 0, -x1, -w) + t.L(-q, -w) + 'Z');
	}
	return pieces.join('');
}

// ------------------------------------------------------------------ Le plan

/**
 * Où tombe chaque chose, selon la composition. Rend les cotes dont le dessin a besoin :
 *   U, V              largeur et hauteur du jardin (sans le cartouche)
 *   cx, cy            le centre (le grand rond)
 *   moities           les deux moitiés du tapis vert : { debut, fin, x0, x1, y, mois: 'haut' | 'bas' }
 *   cu, cv, pasV      la plate-bande et le pas des jours ; SAUT, l'allée entre deux mois
 */
function composition(forme, colonnes) {
	const N = colonnes.length;
	const etroit = forme === 'etroit';
	const mois = colonnes.map((colonne) => colonne[0].date.slice(0, 7));
	const change = (k) => k > 0 && k < N && mois[k] !== mois[k - 1];
	// La coupure entre les deux moitiés : au milieu, et de préférence là où un mois commence.
	const coupure = [Math.floor(N / 2), Math.ceil(N / 2)].find((k) => change(k)) ?? Math.ceil(N / 2);
	const bornes = [[0, coupure], [coupure, N]];
	const sauts = ([debut, fin]) => Array.from({ length: Math.max(0, fin - debut - 1) }, (_, k) => change(debut + 1 + k)).filter(Boolean).length;

	const U = etroit ? 318 : 829;
	const cx = U / 2;
	const SAUT = etroit ? 3 : 3.5;
	const JOINT = 2; // entre deux plates-bandes
	const MARGE = etroit ? 11 : 16; // la rangée d'arbres qui clôt le jardin
	const ALLEE = etroit ? 22 : 24; // entre le tapis vert et les bosquets
	const bande = etroit ? 54 : 112; // les bosquets et les broderies
	const ROND = etroit ? 38 : 64; // la place du bassin central, entre les deux moitiés
	const FIN = etroit ? 17 : 30; // du bord au tapis vert

	// La longueur offerte à chaque moitié, et la plate-bande : de taille fixe, pour que l'image garde la même
	// hauteur d'un jour à l'autre (seul le joint entre deux semaines s'ajuste, de 1,6 à 2,5 px).
	const longueur = etroit ? U - 2 * FIN : cx - ROND / 2 - FIN;
	const cu = etroit ? 7.9 : 10.7;
	const pasV = (cu + JOINT) * (etroit ? 1.25 : 1.3);
	const cv = pasV - JOINT;
	const tapis = 7 * pasV - JOINT;

	const V = etroit ? 2 * (MARGE + bande + ALLEE + tapis) + ROND : 2 * (MARGE + bande + ALLEE) + tapis;
	const cy = V / 2;
	const moities = bornes.map(([debut, fin], rang) => {
		const x0 = etroit ? FIN : rang === 0 ? FIN : cx + ROND / 2;
		const y = etroit ? (rang === 0 ? MARGE + bande + ALLEE : cy + ROND / 2) : cy - tapis / 2;
		// Chaque moitié est justifiée : elle occupe exactement sa longueur, quel que soit son nombre de semaines.
		const nombre = fin - debut;
		const pas = nombre > 1 ? Math.min((longueur - cu - sauts([debut, fin]) * SAUT) / (nombre - 1), cu + 3 * JOINT) : 0;
		const x = [];
		let plume = x0;
		for (let k = debut; k < fin; k++) {
			if (k > debut && change(k)) plume += SAUT;
			x[k] = plume;
			plume += pas;
		}
		return { debut, fin, x, x0, x1: x0 + longueur, y, mois: etroit && rang === 1 ? 'bas' : 'haut', annees: etroit ? null : 'bas' };
	});
	return { N, etroit, mois, change, U, V, cx, cy, moities, cu, cv, pasV, tapis, SAUT, MARGE, ALLEE, bande, ROND, FIN };
}

/**
 * Les étiquettes d'une rangée (mois ou années), chacune à l'aplomb de sa première semaine. Celle qui toucherait
 * la suivante est retirée (un mois entamé en bout de calendrier, trop court pour son chiffre) ; la dernière de
 * la rangée recule pour ne pas dépasser, ou s'efface si son mois se poursuit dans l'autre moitié.
 */
function placer(etiquettes, limite, garde, seProlonge) {
	const gardees = [];
	etiquettes.forEach((etiquette, k) => {
		const suivante = etiquettes[k + 1];
		if (suivante) {
			if (etiquette.x + etiquette.largeur + garde <= suivante.x) gardees.push(etiquette);
			return;
		}
		if (etiquette.x + etiquette.largeur <= limite) return void gardees.push(etiquette);
		if (seProlonge) return;
		const x = limite - etiquette.largeur;
		const precedente = gardees.at(-1);
		if (!precedente || precedente.x + precedente.largeur + garde <= x) gardees.push({ ...etiquette, x });
	});
	return gardees;
}

// ------------------------------------------------------------------ Le dessin

/**
 * Le jardin d'un thème et d'une composition : le texte complet d'un SVG, fond transparent, largeur propre de
 * 829 px (large), 556 px (moyen) ou 318 px (étroit).
 */
export function dessinerJardin({ jours, theme = 'jour', forme = 'large' } = {}) {
	if (!THEMES.includes(theme)) throw new RangeError(`theme : 'jour' ou 'soir' (reçu ${theme}).`);
	if (!FORMES.includes(forme)) throw new RangeError(`forme : 'large', 'moyen' ou 'etroit' (reçu ${forme}).`);
	const propres = nettoyer(jours);
	const colonnes = semaines(propres);
	const soir = theme === 'soir';
	const P = PALETTES[theme];
	const C = composition(forme, colonnes);
	const { N, etroit, mois, change, U, V, cx, cy, moities, cu, cv, pasV, tapis, MARGE, ALLEE, bande, ROND } = C;
	// La composition moyenne est le plan large montré à 556 px : ses textes et ses filets sont tracés `t` fois plus
	// grands, pour retrouver leur corps une fois l'image à sa largeur.
	const moyen = forme === 'moyen';
	const t = moyen ? LARGEURS.large / LARGEURS.moyen : 1;
	const encre = encrier();

	const defs = [];
	const dessous = []; // les arbres d'alignement
	const corps = [];
	const lumieres = []; // le soir, par-dessus tout
	// Quelques lampions vacillent, chacun à son heure.
	let flammes = 0;
	const lampion = (x, y, vacille = false) => `<use href="#lp"${vacille ? ` class="feu" style="animation-delay:${[0, -1.3, -2.6, -0.7, -3.1][flammes++ % 5]}s"` : ''} x="${n1(x)}" y="${n1(y)}"/>`;
	const textes = [];

	// --- Symboles ---
	defs.push(`<linearGradient id="eau" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.eau[0]}"/><stop offset="1" stop-color="${P.eau[1]}"/></linearGradient>`);
	defs.push(
		`<pattern id="feu" width="15" height="13" patternUnits="userSpaceOnUse"><rect width="15" height="13" fill="${P.massif}"/><g fill="${P.grain}"><circle cx="2.2" cy="2.4" r="1.9" opacity="0.55"/><circle cx="8.9" cy="1.6" r="1.4" opacity="0.4"/><circle cx="12.8" cy="5.2" r="2.1" opacity="0.5"/><circle cx="5.6" cy="6.6" r="2.2" opacity="0.45"/><circle cx="1.3" cy="10.4" r="1.6" opacity="0.5"/><circle cx="9.6" cy="10.8" r="1.9" opacity="0.55"/></g><g fill="${P.eclat}"><circle cx="5.2" cy="1.4" r="0.9" opacity="0.8"/><circle cx="11.6" cy="8.6" r="1" opacity="0.7"/><circle cx="3.4" cy="8.2" r="0.8" opacity="0.7"/><circle cx="13.6" cy="11.6" r="0.8" opacity="0.6"/></g></pattern>`,
	);
	const rArbre = etroit ? 2.7 : 3.3;
	defs.push(`<g id="ab"><circle cx="${n1(rArbre * 0.42)}" cy="${n1(rArbre * 0.42)}" r="${rArbre}" fill="${P.ombre}"/><circle r="${rArbre}" fill="${P.arbre}" stroke="${P.lisiere}" stroke-width="0.5"/><circle cx="${n1(-rArbre * 0.27)}" cy="${n1(-rArbre * 0.27)}" r="${n1(rArbre * 0.36)}" fill="${P.reflet}" opacity="${soir ? 0.6 : 0.5}"/></g>`);
	const rIf = etroit ? 1.8 : 2.1;
	defs.push(`<g id="if"><circle cx="1" cy="1" r="${rIf}" fill="${P.ombre}"/><circle r="${rIf}" fill="${P.if}" stroke="${soir ? P.lisiere : 'none'}" stroke-width="0.4"/><circle cx="-0.5" cy="-0.5" r="0.6" fill="#fff" opacity="${soir ? 0.12 : 0.3}"/></g>`);
	const cVase = etroit ? 1.45 : 1.7;
	defs.push(`<g id="vs"><rect x="${n2(-cVase + 0.8)}" y="${n2(-cVase + 0.8)}" width="${n2(2 * cVase)}" height="${n2(2 * cVase)}" fill="${P.ombre}"/><rect x="${-cVase}" y="${-cVase}" width="${n2(2 * cVase)}" height="${n2(2 * cVase)}" fill="${soir ? P.orSombre : P.margelle}" stroke="${P.filet}" stroke-width="0.5"/><circle r="${n2(cVase * 0.47)}" fill="${soir ? P.orClair : P.or}"/></g>`);
	if (soir) {
		defs.push(`<radialGradient id="lueur"><stop offset="0" stop-color="#ffce84" stop-opacity="0.95"/><stop offset="0.3" stop-color="#ffbe70" stop-opacity="0.38"/><stop offset="1" stop-color="#ffbe70" stop-opacity="0"/></radialGradient>`);
		defs.push(`<g id="lp"><circle r="${etroit ? 4.6 : 5.6}" fill="url(#lueur)" opacity="0.85"/><circle r="${etroit ? 0.75 : 0.85}" fill="#ffe7b4"/></g>`);
	}

	// Les cinq états d'une plate-bande, de la plate-bande nue au massif en fleurs (le soir : du gazon éteint au lampion).
	// Les motifs suivent la taille de la plate-bande : `f` vaut 1 dans la composition large.
	const [mx, my] = [cu / 2, cv / 2];
	const court = Math.min(cu, cv);
	const f = court / 10.75;
	const rond = (r, fill, extra = '') => `<circle cx="${n2(mx)}" cy="${n2(my)}" r="${n2(r * f)}" fill="${fill}"${extra}/>`;
	const fleur = (d, r, fill, extra = '') => [[d, 0], [-d, 0], [0, d], [0, -d]].map(([x, y]) => `<circle cx="${n2(mx + (x * f * cu) / court)}" cy="${n2(my + (y * f * cv) / court)}" r="${n2(r * f)}" fill="${fill}"${extra}/>`).join('');
	const carre = (k) => `<rect width="${n2(cu)}" height="${n2(cv)}" rx="${n2(1.2 * f)}" fill="${P.gazon[k]}" stroke="${P.bord[k]}" stroke-width="0.5"/>`;
	const coins = (r, d, fill) => [[d * f, d * f], [cu - d * f, d * f], [d * f, cv - d * f], [cu - d * f, cv - d * f]].map(([x, y]) => `<circle cx="${n2(x)}" cy="${n2(y)}" r="${n2(r * f)}" fill="${fill}"/>`).join('');
	const lisere = (d, stroke, w, extra = '') => `<rect x="${n2(d * f)}" y="${n2(d * f)}" width="${n2(cu - 2 * d * f)}" height="${n2(cv - 2 * d * f)}" rx="0.6" fill="none" stroke="${stroke}" stroke-width="${w}"${extra}/>`;
	const niveaux = soir
		? [
				carre(0),
				carre(1) + rond(0.9, '#d9b869'),
				carre(2) + rond(1.25, '#f3d995'),
				carre(3) + fleur(2.3, 0.75, '#ecd596', ' opacity="0.85"') + rond(1.45, '#ffe9b8'),
				carre(4) + lisere(1.5, '#ecd596', 0.5, ' opacity="0.85"') + fleur(2.4, 0.9, '#ffe9b8') + rond(1.9, '#fff5dc'),
			]
		: [
				carre(0),
				carre(1) + rond(2.2, P.arbre),
				carre(2) + fleur(1.8, 1.5, P.buis) + rond(1.15, P.orClair),
				carre(3) + coins(0.8, 1.9, P.buis) + fleur(1.75, 1.6, P.rance) + rond(1.05, P.sable),
				carre(4) + lisere(1.4, P.orClair, 0.6) + fleur(1.85, 1.6, P.orClair) + rond(1.1, P.rance),
			];
	niveaux.forEach((dessin, k) => defs.push(`<g id="n${k}">${dessin}</g>`));

	// --- Les bassins ---
	const DUREE = 5.4;
	// Les ondes d'un bassin « vivant » s'élargissent en boucle ; au repos (et partout ailleurs) elles sont posées.
	// Dans le grand bassin elles passent sous le soleil, et se posent autour de lui.
	const bassin = (x, y, r, { ondes = 2, astre = false, vivant = false } = {}) => {
		const rides = (astre ? [0.7, 0.84, 0.98] : [0.38, 0.68, 0.98])
			.slice(0, ondes)
			.map((s, k) => {
				const trait = `fill="none" stroke="${P.onde}" stroke-width="0.75" opacity="${[0.8, 0.55, 0.3][k]}"`;
				return vivant ? `<circle class="onde" r="${n1(r - 1.2)}" ${trait} vector-effect="non-scaling-stroke" style="transform:scale(${s});animation-delay:${n2((-DUREE * k) / ondes)}s"/>` : `<circle r="${n2((r - 1.2) * s)}" ${trait}/>`;
			})
			.join('');
		const lueur = astre && soir ? `<circle r="${n1(r * 0.9)}" fill="url(#lueur)" opacity="0.55"/>` : '';
		const coeur = astre ? soleil({ r: r * 0.6, couleur: P.soleil, epaisseur: n2(Math.max(0.7, r / 23)) }) : `<circle r="${n1(Math.max(0.8, r * 0.13))}" fill="${soir ? '#fff' : P.onde}" opacity="0.95"/>`;
		return `<g transform="translate(${n1(x)} ${n1(y)})"><circle cx="1.2" cy="1.2" r="${n1(r + 2.4)}" fill="${P.ombre}"/><circle r="${n1(r + 2.4)}" fill="${P.margelle}" stroke="${P.filet}" stroke-width="0.6"/><circle r="${n1(r)}" fill="url(#eau)" stroke="${soir ? P.orSombre : P.trait}" stroke-opacity="0.55" stroke-width="0.5"/>${lueur}${rides}${coeur}</g>`;
	};

	// --- Les bosquets ---
	const h = bande / 2;
	const lisiere = etroit ? 0.7 : 0.9; // la lisière sombre qui cerne chaque massif
	for (const dessin of ['etoile', 'labyrinthe', 'salle', 'colonnade']) {
		defs.push(`<path id="m-${dessin}" d="${massif(dessin, h, 0)}"/><path id="i-${dessin}" d="${massif(dessin, h, lisiere)}"/>`);
	}
	const bosquet = (dessin, x, y) => {
		let decor = '';
		if (dessin === 'etoile') decor = bassin(0, 0, h * 0.11, { ondes: 1 });
		if (dessin === 'labyrinthe') decor = `<use href="#vs" transform="rotate(45)"/>`;
		if (dessin === 'salle') decor = bassin(0, 0, h * 0.24, { ondes: 2 });
		if (dessin === 'colonnade') {
			const nombre = etroit ? 12 : 20;
			decor =
				`<circle r="${n1(h * 0.4)}" fill="none" stroke="${P.filet}" stroke-width="0.5" opacity="0.8"/>` +
				Array.from({ length: nombre }, (_, k) => `<circle cx="${n1(Math.cos((k / nombre) * TAU) * h * 0.4)}" cy="${n1(Math.sin((k / nombre) * TAU) * h * 0.4)}" r="${etroit ? 1 : 1.25}" fill="${k % 2 ? P.rance : P.margelle}" stroke="${P.filet}" stroke-width="0.4"/>`).join('') +
				`<circle r="${n1(h * 0.16)}" fill="${P.sable}" stroke="${P.filet}" stroke-width="0.5"/><use href="#vs"/>`;
		}
		if (soir && (dessin === 'labyrinthe' || dessin === 'colonnade')) lumieres.push(lampion(x, y));
		return `<g transform="translate(${n1(x)} ${n1(y)})"><use href="#m-${dessin}" fill="${P.ombre}" transform="translate(${etroit ? '1.3 1.3' : '1.8 1.8'})"/><use href="#m-${dessin}" fill="${P.lisiere}"/><use href="#i-${dessin}" fill="url(#feu)"/>${decor}</g>`;
	};

	// --- Les parterres de broderie ---
	const xBande = etroit ? 14 : 30; // où commencent les bandes
	const ECART = etroit ? 7 : 10; // entre deux compartiments
	const TRAVERS = etroit ? 24 : 30; // l'allée qui traverse les bandes dans l'axe du bassin
	const lu = cx - TRAVERS / 2 - (xBande + (etroit ? 1 : 2) * (bande + ECART));
	const lv = bande;
	const cadreBroderie = etroit ? 4.6 : 6.4;
	const quart = quartDeBroderie(lu / 2 - cadreBroderie - 2.1, lv / 2 - cadreBroderie - 2.1);
	defs.push(
		`<g id="rinceau"><path d="${quart.tiges}" fill="none" stroke="${P.buis}" stroke-width="${n2(Math.max(0.95, 1.15 * Math.min(1, quart.k * 1.4)))}" stroke-linecap="round" stroke-linejoin="round"/><path d="${quart.feuilles}" fill="${P.buis}"/>${quart.boutons.map(([x, y], k) => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${etroit ? 1.1 : 1.3}" fill="${k % 2 ? P.rance : P.or}"/>`).join('')}</g>`,
	);
	const broderie = (x, y) => {
		const fleurs = [];
		const semer = (x0, y0, x1, y1) => {
			const nombre = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6.6));
			for (let k = 0; k <= nombre; k++) fleurs.push(`<circle cx="${n1(x0 + ((x1 - x0) * k) / nombre)}" cy="${n1(y0 + ((y1 - y0) * k) / nombre)}" r="${etroit ? 0.7 : 0.85}" fill="${(k + fleurs.length) % 2 ? P.rance : P.or}"/>`);
		};
		const [a, b] = [lu / 2 - cadreBroderie / 2, lv / 2 - cadreBroderie / 2];
		semer(-a + 6, -b, a - 6, -b);
		semer(-a + 6, b, a - 6, b);
		semer(-a, -b + 6, -a, b - 6);
		semer(a, -b + 6, a, b - 6);
		const angles = [[-a, -b], [a, -b], [-a, b], [a, b]];
		const ifs = angles.map(([px, py]) => `<use href="#if" x="${n1(px)}" y="${n1(py)}"/>`).join('');
		if (soir) lumieres.push(...angles.map(([px, py]) => lampion(x + px, y + py)));
		const c = cadreBroderie;
		const cadre = `M${n1(-lu / 2)} ${n1(-lv / 2)}h${n1(lu)}v${n1(lv)}h${n1(-lu)}ZM${n1(-lu / 2 + c)} ${n1(-lv / 2 + c)}h${n1(lu - 2 * c)}v${n1(lv - 2 * c)}h${n1(-lu + 2 * c)}Z`;
		return `<g transform="translate(${n1(x)} ${n1(y)})"><path fill-rule="evenodd" d="${cadre}" fill="${P.ombre}" transform="translate(1.6 1.6)" opacity="0.7"/><path fill-rule="evenodd" d="${cadre}" fill="${P.gazon[1]}" stroke="${P.bord[1]}" stroke-width="0.6"/><rect x="${n1(-lu / 2 + c)}" y="${n1(-lv / 2 + c)}" width="${n1(lu - 2 * c)}" height="${n1(lv - 2 * c)}" fill="${P.sable}"/>${fleurs.join('')}${ifs}<use href="#rinceau"/><use href="#rinceau" transform="scale(-1 1)"/><use href="#rinceau" transform="scale(1 -1)"/><use href="#rinceau" transform="scale(-1 -1)"/>${bassin(0, 0, 7.4 * Math.min(1, quart.k * 1.15), { ondes: 2 })}</g>`;
	};

	// --- Les deux bandes, de part et d'autre du tapis vert, symétriques ---
	const yBandes = [MARGE + h, V - MARGE - h];
	yBandes.forEach((y, rang) => {
		if (etroit) {
			corps.push(bosquet(rang === 0 ? 'etoile' : 'labyrinthe', xBande + h, y), bosquet(rang === 0 ? 'salle' : 'colonnade', U - xBande - h, y));
		} else {
			corps.push(bosquet('etoile', xBande + h, y), bosquet('labyrinthe', xBande + bande + ECART + h, y));
			corps.push(bosquet('salle', U - xBande - bande - ECART - h, y), bosquet('colonnade', U - xBande - h, y));
		}
		corps.push(broderie(cx - TRAVERS / 2 - lu / 2, y), broderie(cx + TRAVERS / 2 + lu / 2, y));
	});

	// --- Les arbres d'alignement qui ferment le jardin ---
	const arbre = (x, y) => `<use href="#ab" x="${n1(x)}" y="${n1(y)}"/>`;
	const PAS_ARBRE = etroit ? 7.6 : 9.2;
	const rive = etroit ? 5.5 : MARGE - 6.5; // la distance du bord à la file d'arbres
	const petitsBassins = [];
	if (etroit) {
		// Un cadre : deux files en haut et en bas, deux sur les côtés, ouvertes au bout des deux axes.
		const file = (x0, y0, x1, y1, sauf) => {
			const nombre = Math.round(Math.hypot(x1 - x0, y1 - y0) / PAS_ARBRE);
			for (let k = 0; k <= nombre; k++) {
				const [x, y] = [x0 + ((x1 - x0) * k) / nombre, y0 + ((y1 - y0) * k) / nombre];
				if (!sauf(x, y)) dessous.push(arbre(x, y));
			}
		};
		const pres = (a, b) => Math.abs(a - b) < 9.5;
		file(rive, rive, U - rive, rive, (x) => pres(x, cx));
		file(rive, V - rive, U - rive, V - rive, (x) => pres(x, cx));
		file(rive, rive + PAS_ARBRE, rive, V - rive - PAS_ARBRE, (x, y) => pres(y, cy));
		file(U - rive, rive + PAS_ARBRE, U - rive, V - rive - PAS_ARBRE, (x, y) => pres(y, cy));
		petitsBassins.push([cx, rive + 0.8, 4.3], [cx, V - rive - 0.8, 4.3], [rive + 1.2, cy, 4.3], [U - rive - 1.2, cy, 4.3]);
	} else {
		// Deux longs côtés, et deux bouts en anse de panier.
		const xCoin = xBande - 9;
		const [debut, fin] = [xCoin, U - xCoin];
		const nombre = Math.round((fin - debut) / PAS_ARBRE);
		for (let k = 0; k <= nombre; k++) {
			const x = debut + ((fin - debut) * k) / nombre;
			if (Math.abs(x - cx) < TRAVERS / 2 + 5) continue;
			dessous.push(arbre(x, rive), arbre(x, V - rive));
		}
		const nv = Math.round(bande / PAS_ARBRE);
		for (let k = 1; k <= nv; k++) {
			const dy = (bande * k) / nv + 2.7;
			for (const x of [debut, fin]) dessous.push(arbre(x, rive + dy), arbre(x, V - rive - dy));
		}
		// L'anse : un arc de cercle tendu entre les deux bandes, dont la flèche laisse la place d'un bassin.
		const corde = cy - (rive + bande + 2.7);
		const fleche = xCoin - 5.5;
		const rayon = (corde ** 2 + fleche ** 2) / (2 * fleche);
		const ouverture = Math.asin(corde / rayon);
		const na = Math.round((2 * ouverture * rayon) / PAS_ARBRE);
		for (let k = 1; k < na; k++) {
			const angle = -ouverture + (2 * ouverture * k) / na;
			const dx = rayon - Math.cos(angle) * rayon; // 0 au sommet de l'anse
			const dy = Math.sin(angle) * rayon;
			dessous.push(arbre(5.5 + dx, cy + dy), arbre(U - 5.5 - dx, cy + dy));
		}
		petitsBassins.push([cx, 8.6, 6], [cx, V - 8.6, 6], [19.5, cy, 6.2], [U - 19.5, cy, 6.2]);
	}

	// --- Les chiffres : les mois en chiffres romains le long du tapis vert, les années de l'autre côté ---
	// Les étiquettes du jardin sont celles du reste du profil (et du site) : capitales de graisse 500.
	// Aucun texte sous 9 px à la largeur propre de l'image.
	const styleMois = { taille: etroit ? 9.6 : moyen ? 9.2 * t : 10.5, graisse: 500, espacement: 0.1, fill: P.texte };
	const styleAnnee = { taille: moyen ? 9.2 * t : 9.8, graisse: 500, espacement: 0.16, fill: P.texteDoux };
	// La distance du tapis vert à ses chiffres : en moyen ils sont plus hauts, et se rapprochent du tapis pour ne
	// pas toucher la file d'ifs et de vases.
	const recul = moyen ? 5.2 : 6.8;
	let dernierMois = null; // le dernier mois qui a reçu son chiffre
	for (const moitie of moities) {
		const lesMois = [];
		const lesAnnees = [];
		for (let k = moitie.debut; k < moitie.fin; k++) {
			const nouveau = k === 0 || change(k);
			// Un mois à cheval sur les deux moitiés est redit au début de la seconde.
			const suite = k === moitie.debut && !nouveau;
			if (!nouveau && !suite) continue;
			const numero = romain(Number(mois[k].slice(5)));
			lesMois.push({ texte: numero, mois: mois[k], suite, x: moitie.x[k] + 0.4, largeur: encre.mesurer(numero, styleMois) });
			if (k === 0 || (nouveau && mois[k].endsWith('-01'))) {
				const an = romain(Number(mois[k].slice(0, 4)));
				lesAnnees.push({ texte: an, x: moitie.x[k] + 0.4, largeur: encre.mesurer(an, styleAnnee) });
			}
		}
		const seProlonge = moitie.fin < N && !change(moitie.fin);
		const limite = moitie.x1 + 3.4;
		const yMois = moitie.mois === 'haut' ? moitie.y - recul : moitie.y + tapis + recul + encre.capitale(styleMois);
		for (const etiquette of placer(lesMois, limite, 3.2 * t, seProlonge)) {
			// En large les deux moitiés sont sur la même ligne : on ne redit pas un mois déjà nommé juste avant.
			if (etiquette.suite && !etroit && dernierMois === etiquette.mois) continue;
			textes.push(encre.ecrire(etiquette.texte, { ...styleMois, x: etiquette.x, y: yMois }));
			dernierMois = etiquette.mois;
		}
		if (moitie.annees) for (const { texte, x } of placer(lesAnnees, limite, 6 * t, false)) textes.push(encre.ecrire(texte, { ...styleAnnee, x, y: moitie.y + tapis + recul - 0.4 + encre.capitale(styleAnnee) }));
	}

	// --- Les ifs taillés et les vases le long des allées ; le soir, un lampion sur chaque vase ---
	{
		const planter = (x, y, k, cadence) => {
			corps.push(`<use href="#${k % 2 ? 'vs' : 'if'}" x="${n1(x)}" y="${n1(y)}"/>`);
			if (soir && k % 2) lumieres.push(lampion(x, y, k % cadence === 1));
		};
		const debut = xBande + 4;
		const fin = U - xBande - 4;
		const nombre = Math.round((fin - debut) / (etroit ? 11.2 : 13.2));
		for (let k = 0; k <= nombre; k++) {
			const x = debut + ((fin - debut) * k) / nombre;
			if (Math.abs(x - cx) < TRAVERS / 2 + 3) continue;
			for (const y of [MARGE + bande + 5.5, V - MARGE - bande - 5.5]) planter(x, y, k, 12);
		}
		if (etroit) {
			// L'allée du milieu, entre les deux moitiés : une file d'ifs et de vases de chaque côté du bassin.
			const libre = ROND / 2 + 5;
			const pas = (cx - libre - (xBande + 6)) / 9;
			for (let k = 0; k <= 9; k++) for (const sens of [-1, 1]) planter(cx + sens * (libre + k * pas), cy, k + 1, 12);
		}
		// L'allée transversale : deux files d'ifs, du bassin central aux deux bassins du bout.
		const nt = Math.max(2, Math.round((bande - 8) / 12.5));
		for (let k = 0; k <= nt; k++) {
			const dy = 6 + ((bande - 12) * k) / nt;
			for (const x of [cx - TRAVERS / 2 + (etroit ? 4 : 4.5), cx + TRAVERS / 2 - (etroit ? 4 : 4.5)])
				for (const y of [MARGE + dy, V - MARGE - dy]) {
					corps.push(`<use href="#if" x="${n1(x)}" y="${n1(y)}"/>`);
					if (soir && k % 2 === 1) lumieres.push(lampion(x, y + (y < cy ? 6 : -6)));
				}
		}
	}

	// --- Le tapis vert : une plate-bande par jour, chaque moitié bordée d'un filet d'or ---
	for (const moitie of moities) {
		corps.push(`<rect x="${n1(moitie.x0 - 3.4)}" y="${n1(moitie.y - 3.4)}" width="${n1(moitie.x1 - moitie.x0 + 6.8)}" height="${n1(tapis + 6.8)}" rx="2.4" fill="none" stroke="${P.filet}" stroke-width="0.6" opacity="${soir ? 0.55 : 0.6}"/>`);
	}
	const halos = [];
	const moitieDe = (k) => moities.find((moitie) => k >= moitie.debut && k < moitie.fin);
	colonnes.forEach((semaine, k) => {
		const moitie = moitieDe(k);
		for (const jour of semaine) {
			const [x, y] = [moitie.x[k], moitie.y + jour.rang * pasV];
			corps.push(`<use href="#n${jour.niveau}" x="${n2(x)}" y="${n2(y)}"/>`);
			if (soir && jour.niveau >= 1) halos.push(`<circle cx="${n1(x + mx)}" cy="${n1(y + my)}" r="${n1([0, 3.6, 6, 9.5, 14][jour.niveau] * Math.max(f, 0.8))}" fill="url(#lueur)" opacity="${[0, 0.4, 0.6, 0.8, 0.95][jour.niveau]}"/>`);
		}
	});
	lumieres.push(...halos);

	// --- Le grand rond au croisement des axes, et un bassin à chaque bout des deux axes ---
	const rRond = etroit ? 10.5 : 21;
	{
		if (!etroit) {
			for (let k = 0; k < 8; k++) {
				const angle = (k / 8) * TAU + TAU / 16;
				corps.push(`<use href="#if" x="${n1(cx + Math.cos(angle) * (rRond + 8.5))}" y="${n1(cy + Math.sin(angle) * (rRond + 8.5))}"/>`);
			}
		}
		corps.push(bassin(cx, cy, rRond, { ondes: 3, astre: true, vivant: true }));
		// En large, l'eau bouge aussi aux deux bouts du grand axe.
		petitsBassins.forEach(([x, y, r], k) => corps.push(bassin(x, y, r, { ondes: k < 2 ? 1 : 2, vivant: !etroit && k >= 2 })));
		if (soir) {
			const nombre = etroit ? 8 : 12;
			const rayon = rRond + (etroit ? 4.6 : 5);
			for (let k = 0; k < nombre; k++) {
				const angle = (k / nombre) * TAU + (etroit ? TAU / 16 : 0);
				lumieres.push(lampion(cx + Math.cos(angle) * rayon, cy + Math.sin(angle) * rayon, k % (etroit ? 4 : 3) === 0));
			}
		}
	}

	// --- Le cartouche : le total, l'échelle des cinq états (le plus petit nombre relevé à chaque niveau), les années ---
	const total = propres.reduce((somme, jour) => somme + jour.nombre, 0);
	const seuils = [0, 1, 2, 3, 4].map((niveau) => {
		const nombres = propres.filter((jour) => jour.niveau === niveau).map((jour) => jour.nombre);
		return nombres.length ? Math.min(...nombres) : null;
	});
	const ans = [...new Set([propres[0].date, propres.at(-1).date].map((date) => romain(Number(date.slice(0, 4)))))].join(' – ');
	const gauche = `${milliers(total, THOUSANDS)} CONTRIBUTION${total === 1 ? '' : 'S'}`;
	// Le filet et l'étiquette du cartouche sont ceux du profil : un trait d'or d'un pixel, des capitales de
	// graisse 500 espacées de 0,16 em, au corps des autres étiquettes (13 px en large, 11,5 en moyen, 10,5 en étroit).
	const filet = (xa, xb, y) => (xb - xa > 12 * t ? `<path d="M${n1(xa)} ${n1(y)}H${n1(xb)}" stroke="${P.filet}" stroke-width="${n2(t)}" opacity="${soir ? 0.62 : 0.9}"/>` : '');
	const styleSeuil = { taille: etroit ? 9 : moyen ? 9.2 * t : 9.8, graisse: 500, fill: P.texteDoux };
	// Un texte du cartouche plus long que sa place (un total à six chiffres, des années aux longs chiffres romains)
	// se resserre, puis rapetisse : il ne sort jamais de l'image. Un texte qui tient n'est pas touché.
	const ajuster = (chaine, style, place) => {
		for (const espacement of [style.espacement, 0.12, 0.08, 0.04]) {
			const essai = { ...style, espacement: Math.min(espacement, style.espacement) };
			if (encre.mesurer(chaine, essai) <= place) return essai;
		}
		const serre = { ...style, espacement: 0.04 };
		return { ...serre, taille: n2((style.taille * place) / encre.mesurer(chaine, serre)) };
	};
	const ecart = etroit ? 34 : moyen ? 44 : 33;
	const x0 = U / 2 - 2 * ecart;
	let hauteur;
	const echelle = (y) => {
		seuils.forEach((seuil, k) => {
			textes.push(`<use href="#n${k}" x="${n1(x0 + k * ecart - cu / 2)}" y="${n1(y)}"/>`);
			if (seuil !== null) textes.push(encre.ecrire(k === 0 ? '0' : `${seuil}+`, { ...styleSeuil, x: x0 + k * ecart, y: y + cv + 4.6 * t + encre.capitale(styleSeuil), ancre: 'middle' }));
		});
	};
	if (etroit) {
		// Deux lignes : le total et les années, puis l'échelle.
		let style = { taille: 10.5, graisse: 500, espacement: 0.16, fill: P.texte };
		let ligne = `${gauche}  ·  ${ans}`;
		for (const espacement of [0.16, 0.12, 0.08]) {
			style = { ...style, espacement };
			if (encre.mesurer(ligne, style) <= U - 16) break;
		}
		let y = V + 12 + encre.capitale(style);
		if (encre.mesurer(ligne, style) > U - 16) {
			// Des années trop longues pour la ligne : elles passent dessous.
			style = { ...style, espacement: 0.16 };
			textes.push(encre.ecrire(gauche, { ...ajuster(gauche, style, U - 16), x: U / 2, y, ancre: 'middle' }));
			y += 15;
			ligne = ans;
			style = ajuster(ligne, style, U - 16);
		}
		const l = encre.mesurer(ligne, style);
		textes.push(encre.ecrire(ligne, { ...style, x: U / 2, y, ancre: 'middle' }));
		const yFilet = y - encre.capitale(style) / 2;
		textes.push(filet(8, U / 2 - l / 2 - 10, yFilet), filet(U / 2 + l / 2 + 10, U - 8, yFilet));
		echelle(y + 12);
		hauteur = y + 12 + cv + 4.6 + encre.capitale(styleSeuil) + 5;
	} else {
		const style = { taille: moyen ? 11.5 * t : 13, graisse: 500, espacement: 0.16, fill: P.texte };
		const y = V + 14;
		const yt = y + cv / 2 + encre.capitale(style) / 2;
		const [xg, xd] = [x0 - 44 * t, x0 + 4 * ecart + 44 * t];
		const yFilet = yt - encre.capitale(style) / 2;
		echelle(y);
		// Chaque texte a pour place ce qui reste entre l'échelle et le bord de l'image, à 6 px du bord.
		const [styleGauche, styleAns] = [ajuster(gauche, style, xg - 6 * t), ajuster(ans, style, U - 6 * t - xd)];
		textes.push(encre.ecrire(gauche, { ...styleGauche, x: xg, y: yt, ancre: 'end' }), encre.ecrire(ans, { ...styleAns, x: xd, y: yt }));
		textes.push(filet(xBande, xg - encre.mesurer(gauche, styleGauche) - 16 * t, yFilet), filet(xd + encre.mesurer(ans, styleAns) + 16 * t, U - xBande, yFilet));
		hauteur = y + cv + 4.6 * t + encre.capitale(styleSeuil) + 6 * t;
	}

	const style = `.onde{transform-origin:0 0}@media (prefers-reduced-motion:no-preference){.onde{animation:onde ${DUREE}s cubic-bezier(.2,.6,.35,1) infinite}@keyframes onde{from{transform:scale(.1);opacity:0}14%{opacity:.95}to{transform:scale(1);opacity:0}}${soir ? '.feu{animation:feu 3.6s ease-in-out infinite alternate}@keyframes feu{from{opacity:1}to{opacity:.55}}' : ''}}`;
	const resume = resumer(propres);
	const titre = `Formal garden plan: ${milliers(resume.total, ',')} contribution${resume.total === 1 ? '' : 's'} on ${resume.actifs} active day${resume.actifs === 1 ? '' : 's'}, ${resume.debut} to ${resume.fin}`;
	// La largeur propre de l'image, en pixels entiers, et le cadre du dessin dans le même rapport.
	const [L, H] = [LARGEURS[forme], Math.ceil(hauteur / t)];
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${U} ${Number((H * t).toFixed(4))}" width="${L}" height="${H}"><title>${titre}</title><style>${style}</style><defs>${defs.join('')}${encre.defs()}</defs>${dessous.join('')}${corps.join('')}${lumieres.join('')}${textes.join('')}</svg>\n`;
}

// ------------------------------------------------------------------ Le fragment du README

const MOIS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const moisDe = (date) => `${MOIS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

/** Ce que l'image montre, pour qui ne la voit pas : en anglais, avec le total et le nombre de jours actifs. */
export function legendeDuJardin({ jours }) {
	const { total, actifs, jours: nombre, debut, fin } = resumer(jours);
	return `Plan of a formal French garden. Its lawn is my GitHub contribution calendar from ${moisDe(debut)} to ${moisDe(fin)}: ${milliers(total, ',')} contribution${total === 1 ? '' : 's'} on ${actifs} active day${actifs === 1 ? '' : 's'} out of ${nombre}. One flower bed per day: bare on idle days, in flower on busy ones.`;
}

/**
 * Le fragment de README du jardin, à poser entre <!-- jardin:debut --> et <!-- jardin:fin -->.
 * Une image seule, à sa largeur propre ; <picture> choisit le thème et la composition (une <source> par
 * requête : pas de liste séparée par des virgules).
 *
 * L'ordre des sources est celui de tout le profil (voir lisezmoi.mjs dans le portfolio). Pour un visiteur dont
 * l'apparence de GitHub est réglée sur un thème sombre fixe, github.com efface la condition de largeur des
 * sources sombres : la première l'emporte à toute largeur. C'est donc la composition étroite, qui tient
 * partout ; elle est aussi l'image par défaut du jour.
 */
export function blocDuJardin({ jours }) {
	const alt = legendeDuJardin({ jours }).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
	const requete = ([min, max]) => [min === null ? '' : `(min-width: ${min}px)`, max === null ? '' : `(max-width: ${max}px)`].filter(Boolean).join(' and ');
	// Deux <picture> jumeaux, celui du jour puis celui du soir : aucune source ne cite à la fois un thème et une
	// largeur, parce que github.com efface la largeur des sources qui citent un thème quand le visiteur a choisi un
	// thème fixe (voir profil/lisezmoi.mjs dans le générateur). Chaque jumeau se remplace par assets/vide.svg, une
	// image qui ne prend aucune place, dans le thème de l'autre ; seul le premier porte le texte alt.
	const jumeau = (theme, autreTheme, texte) =>
		`<picture><source media="(prefers-color-scheme: ${autreTheme})" srcset="assets/vide.svg">${['moyen', 'large'].flatMap((forme) => FENETRES[forme].map((fenetre) => `<source media="${requete(fenetre)}" srcset="assets/jardin-${forme}-${theme}.svg">`)).join('')}<img src="assets/jardin-etroit-${theme}.svg" alt="${texte}"></picture>`;
	return `<p align="center">${jumeau('jour', 'dark', alt)}${jumeau('soir', 'light', '')}</p>`;
}
