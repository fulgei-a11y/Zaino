/* Zaino — Filosofia e Scienze umane.
   Autori in ordine di tempo, scheda autore (preparata dall'IA e salvata sul dispositivo),
   confronto tra due autori, domande all'autore, spiegazione di un concetto.
   Usa le funzioni di app.js: parte con autori.init(). */
"use strict";

/* =========================================================
   1. DATI: autori con anni di nascita e morte (negativi = a.C.)
   ========================================================= */
const FILO_PERIODS = [
  { id: "antica", short: "Antica", name: "Filosofia antica", from: -650, to: 529, desc: "Dai primi filosofi greci alla fine del mondo antico", c: "sky" },
  { id: "medievale", short: "Medioevo", name: "Filosofia medievale", from: 354, to: 1400, desc: "Fede e ragione", c: "lilac" },
  { id: "rinascimento", short: "Rinascimento", name: "Umanesimo, Rinascimento e rivoluzione scientifica", from: 1400, to: 1650, desc: "L'uomo al centro, la nascita della scienza moderna", c: "mint", school: "di solito in quarta" },
  { id: "moderna", short: "Età moderna", name: "Età moderna: razionalismo, empirismo, Illuminismo, Kant", from: 1590, to: 1804, desc: "Che cosa possiamo conoscere? Ragione o esperienza?", c: "yellow", school: "di solito in quarta" },
  { id: "ottocento", short: "Ottocento", name: "Ottocento", from: 1760, to: 1900, desc: "Idealismo, critici di Hegel, positivismo, Nietzsche", c: "pink", school: "fine quarta o quinta" },
  { id: "novecento", short: "Novecento", name: "Novecento", from: 1856, to: 2000, desc: "Psicoanalisi, esistenzialismo, linguaggio, scienza, politica", c: "sky", school: "di solito in quinta" }
];
const FILOSOFI = [
  ["talete", "Talete", -624, -546, "antica", "Il principio di tutto è l'acqua"],
  ["anassimandro", "Anassimandro", -610, -546, "antica", "L'àpeiron, l'infinito"],
  ["anassimene", "Anassimene", -586, -528, "antica", "Il principio è l'aria"],
  ["pitagora", "Pitagora", -570, -495, "antica", "Tutto è numero"],
  ["eraclito", "Eraclito", -535, -475, "antica", "Tutto scorre: il divenire"],
  ["parmenide", "Parmenide", -515, -450, "antica", "L'essere è, il non essere non è"],
  ["zenone-elea", "Zenone di Elea", -490, -430, "antica", "I paradossi (Achille e la tartaruga)"],
  ["empedocle", "Empedocle", -495, -435, "antica", "Quattro elementi, Amore e Odio"],
  ["anassagora", "Anassagora", -500, -428, "antica", "I semi e l'Intelletto (Nous)"],
  ["democrito", "Democrito", -460, -370, "antica", "Tutto è fatto di atomi"],
  ["protagora", "Protagora", -490, -420, "antica", "L'uomo è misura di tutte le cose"],
  ["gorgia", "Gorgia", -483, -375, "antica", "Il potere della parola"],
  ["socrate", "Socrate", -470, -399, "antica", "So di non sapere"],
  ["platone", "Platone", -428, -348, "antica", "Il mondo delle idee"],
  ["aristotele", "Aristotele", -384, -322, "antica", "Sostanza, logica, il giusto mezzo"],
  ["epicuro", "Epicuro", -341, -270, "antica", "La felicità come assenza di dolore"],
  ["zenone-cizio", "Zenone di Cizio", -334, -262, "antica", "Lo stoicismo: vivere secondo natura"],
  ["plotino", "Plotino", 204, 270, "antica", "Tutto deriva dall'Uno"],
  ["agostino", "Agostino d'Ippona", 354, 430, "medievale", "Fede e ragione; che cos'è il tempo"],
  ["anselmo", "Anselmo d'Aosta", 1033, 1109, "medievale", "La prova ontologica di Dio"],
  ["tommaso", "Tommaso d'Aquino", 1225, 1274, "medievale", "Le cinque vie"],
  ["ockham", "Guglielmo di Ockham", 1287, 1347, "medievale", "Il rasoio: non moltiplicare gli enti"],
  ["machiavelli", "Niccolò Machiavelli", 1469, 1527, "rinascimento", "Il Principe: la politica separata dalla morale"],
  ["bruno", "Giordano Bruno", 1548, 1600, "rinascimento", "L'universo infinito e i mondi infiniti"],
  ["bacone", "Francesco Bacone", 1561, 1626, "rinascimento", "Il metodo induttivo e gli idola"],
  ["galilei", "Galileo Galilei", 1564, 1642, "rinascimento", "Il metodo scientifico"],
  ["hobbes", "Thomas Hobbes", 1588, 1679, "moderna", "Il Leviatano: lo Stato nasce dalla paura"],
  ["cartesio", "Cartesio", 1596, 1650, "moderna", "Penso, dunque sono"],
  ["pascal", "Blaise Pascal", 1623, 1662, "moderna", "Il cuore ha le sue ragioni"],
  ["spinoza", "Baruch Spinoza", 1632, 1677, "moderna", "Dio, ovvero la Natura"],
  ["locke", "John Locke", 1632, 1704, "moderna", "La mente è una tabula rasa"],
  ["leibniz", "Gottfried W. Leibniz", 1646, 1716, "moderna", "Le monadi; il migliore dei mondi possibili"],
  ["berkeley", "George Berkeley", 1685, 1753, "moderna", "Essere è essere percepito"],
  ["montesquieu", "Montesquieu", 1689, 1755, "moderna", "La divisione dei poteri"],
  ["voltaire", "Voltaire", 1694, 1778, "moderna", "La tolleranza"],
  ["hume", "David Hume", 1711, 1776, "moderna", "La causalità nasce dall'abitudine"],
  ["rousseau", "Jean-Jacques Rousseau", 1712, 1778, "moderna", "Il contratto sociale; l'uomo nasce buono"],
  ["kant", "Immanuel Kant", 1724, 1804, "moderna", "Le tre Critiche: conoscenza, morale, giudizio"],
  ["fichte", "Johann G. Fichte", 1762, 1814, "ottocento", "L'Io pone se stesso"],
  ["hegel", "Georg W. F. Hegel", 1770, 1831, "ottocento", "La dialettica: tesi, antitesi, sintesi"],
  ["schelling", "Friedrich Schelling", 1775, 1854, "ottocento", "Natura e spirito sono la stessa cosa"],
  ["schopenhauer", "Arthur Schopenhauer", 1788, 1860, "ottocento", "La vita oscilla tra dolore e noia"],
  ["comte", "Auguste Comte", 1798, 1857, "ottocento", "Il positivismo e la legge dei tre stadi"],
  ["feuerbach", "Ludwig Feuerbach", 1804, 1872, "ottocento", "L'uomo crea Dio a sua immagine"],
  ["mill", "John Stuart Mill", 1806, 1873, "ottocento", "La libertà e l'utilitarismo"],
  ["kierkegaard", "Søren Kierkegaard", 1813, 1855, "ottocento", "La scelta, l'angoscia, la fede"],
  ["marx", "Karl Marx", 1818, 1883, "ottocento", "Il materialismo storico e la lotta di classe"],
  ["nietzsche", "Friedrich Nietzsche", 1844, 1900, "ottocento", "La morte di Dio e l'oltreuomo"],
  ["freud", "Sigmund Freud", 1856, 1939, "novecento", "L'inconscio"],
  ["bergson", "Henri Bergson", 1859, 1941, "novecento", "Il tempo vissuto come durata"],
  ["husserl", "Edmund Husserl", 1859, 1938, "novecento", "La fenomenologia: tornare alle cose stesse"],
  ["heidegger", "Martin Heidegger", 1889, 1976, "novecento", "Essere e tempo; l'essere-per-la-morte"],
  ["wittgenstein", "Ludwig Wittgenstein", 1889, 1951, "novecento", "I limiti del linguaggio"],
  ["popper", "Karl Popper", 1902, 1994, "novecento", "Una teoria è scientifica se è falsificabile"],
  ["jonas", "Hans Jonas", 1903, 1993, "novecento", "Il principio responsabilità"],
  ["sartre", "Jean-Paul Sartre", 1905, 1980, "novecento", "L'uomo è condannato a essere libero"],
  ["arendt", "Hannah Arendt", 1906, 1975, "novecento", "La banalità del male"],
  ["beauvoir", "Simone de Beauvoir", 1908, 1986, "novecento", "Donna non si nasce, lo si diventa"]
];

const UMANE_AREAS = [
  { id: "pedagogia", name: "Pedagogia", desc: "Come si educa e come si impara", c: "mint" },
  { id: "psicologia", name: "Psicologia", desc: "La mente, lo sviluppo, il comportamento", c: "sky" },
  { id: "sociologia", name: "Sociologia", desc: "La società, i gruppi, le istituzioni", c: "yellow" },
  { id: "antropologia", name: "Antropologia", desc: "Le culture e i modi di vivere dei popoli", c: "pink" }
];
const UMANE = [
  ["quintiliano", "Quintiliano", 35, 96, "pedagogia", "L'educazione dell'oratore e il rispetto per l'allievo"],
  ["vittorino", "Vittorino da Feltre", 1378, 1446, "pedagogia", "La Casa Giocosa: educare corpo e mente"],
  ["erasmo", "Erasmo da Rotterdam", 1466, 1536, "pedagogia", "Educare con dolcezza, fin da piccoli"],
  ["montaigne", "Michel de Montaigne", 1533, 1592, "pedagogia", "Meglio una testa ben fatta che ben piena"],
  ["calasanzio", "Giuseppe Calasanzio", 1557, 1648, "pedagogia", "Le Scuole Pie: istruzione gratuita per i poveri"],
  ["comenio", "Comenio", 1592, 1670, "pedagogia", "Insegnare tutto a tutti (Didactica magna)"],
  ["locke-ped", "John Locke", 1632, 1704, "pedagogia", "Pensieri sull'educazione: il gentleman"],
  ["rousseau-ped", "Jean-Jacques Rousseau", 1712, 1778, "pedagogia", "Emilio: l'educazione naturale"],
  ["pestalozzi", "Johann H. Pestalozzi", 1746, 1827, "pedagogia", "Educare mente, cuore e mano"],
  ["herbart", "Johann F. Herbart", 1776, 1841, "pedagogia", "La pedagogia come scienza e l'interesse"],
  ["frobel", "Friedrich Fröbel", 1782, 1852, "pedagogia", "Il giardino d'infanzia (Kindergarten)"],
  ["lambruschini", "Raffaello Lambruschini", 1788, 1873, "pedagogia", "Educare alla libertà e alla coscienza"],
  ["aporti", "Ferrante Aporti", 1791, 1858, "pedagogia", "I primi asili infantili in Italia"],
  ["rosmini", "Antonio Rosmini", 1797, 1855, "pedagogia", "Il principio della gradazione nell'educazione"],
  ["bosco", "Giovanni Bosco", 1815, 1888, "pedagogia", "Il sistema preventivo e gli oratori"],
  ["gabelli", "Aristide Gabelli", 1830, 1891, "pedagogia", "Il positivismo pedagogico e la testa come strumento"],
  ["kerschensteiner", "Georg Kerschensteiner", 1854, 1932, "pedagogia", "La scuola del lavoro"],
  ["dewey", "John Dewey", 1859, 1952, "pedagogia", "Imparare facendo: l'attivismo"],
  ["agazzi", "Rosa e Carolina Agazzi", 1866, 1951, "pedagogia", "La scuola materna e il materiale povero"],
  ["pizzigoni", "Giuseppina Pizzigoni", 1870, 1947, "pedagogia", "La Scuola Rinnovata: imparare dall'esperienza"],
  ["montessori", "Maria Montessori", 1870, 1952, "pedagogia", "La Casa dei bambini e il metodo Montessori"],
  ["decroly", "Ovide Decroly", 1871, 1932, "pedagogia", "I centri d'interesse e il metodo globale"],
  ["claparede", "Édouard Claparède", 1873, 1940, "pedagogia", "La scuola su misura"],
  ["gentile-ped", "Giovanni Gentile", 1875, 1944, "pedagogia", "La riforma della scuola del 1923"],
  ["lombardoradice", "Giuseppe Lombardo Radice", 1879, 1938, "pedagogia", "La scuola serena e la didattica viva"],
  ["maritain", "Jacques Maritain", 1882, 1973, "pedagogia", "Il personalismo: l'educazione al bivio"],
  ["neill", "Alexander S. Neill", 1883, 1973, "pedagogia", "Summerhill: la scuola della libertà"],
  ["makarenko", "Anton Makarenko", 1888, 1939, "pedagogia", "L'educazione nel collettivo"],
  ["gramsci-ped", "Antonio Gramsci", 1891, 1937, "pedagogia", "La scuola unitaria e gli intellettuali"],
  ["freinet", "Célestin Freinet", 1896, 1966, "pedagogia", "La tipografia a scuola, il testo libero"],
  ["bloom", "Benjamin Bloom", 1913, 1999, "pedagogia", "La tassonomia degli obiettivi e il mastery learning"],
  ["rodari", "Gianni Rodari", 1920, 1980, "pedagogia", "La grammatica della fantasia"],
  ["morin", "Edgar Morin", 1921, 2026, "pedagogia", "La testa ben fatta e il pensiero complesso"],
  ["freire", "Paulo Freire", 1921, 1997, "pedagogia", "La pedagogia degli oppressi"],
  ["lodi", "Mario Lodi", 1922, 2014, "pedagogia", "Il paese sbagliato: la classe come comunità"],
  ["milani", "Don Lorenzo Milani", 1923, 1967, "pedagogia", "Lettera a una professoressa: la scuola di Barbiana"],
  ["illich", "Ivan Illich", 1926, 2002, "pedagogia", "Descolarizzare la società"],
  ["wundt", "Wilhelm Wundt", 1832, 1920, "psicologia", "Il primo laboratorio di psicologia"],
  ["james", "William James", 1842, 1910, "psicologia", "Il funzionalismo e il flusso di coscienza"],
  ["pavlov", "Ivan Pavlov", 1849, 1936, "psicologia", "Il condizionamento classico"],
  ["ebbinghaus", "Hermann Ebbinghaus", 1850, 1909, "psicologia", "La memoria e la curva dell'oblio"],
  ["freud-psi", "Sigmund Freud", 1856, 1939, "psicologia", "La psicoanalisi e l'inconscio"],
  ["titchener", "Edward B. Titchener", 1867, 1927, "psicologia", "Lo strutturalismo e l'introspezione"],
  ["adler", "Alfred Adler", 1870, 1937, "psicologia", "Il senso di inferiorità e la psicologia individuale"],
  ["thorndike", "Edward Thorndike", 1874, 1949, "psicologia", "Prove ed errori e la legge dell'effetto"],
  ["jung", "Carl Gustav Jung", 1875, 1961, "psicologia", "L'inconscio collettivo e gli archetipi"],
  ["watson", "John B. Watson", 1878, 1958, "psicologia", "Il comportamentismo"],
  ["wallon", "Henri Wallon", 1879, 1962, "psicologia", "Emozioni, movimento e sviluppo della persona"],
  ["wertheimer", "Max Wertheimer", 1880, 1943, "psicologia", "La Gestalt: il tutto è più delle parti"],
  ["klein", "Melanie Klein", 1882, 1960, "psicologia", "Il mondo interno del bambino e il gioco"],
  ["tolman", "Edward C. Tolman", 1886, 1959, "psicologia", "Le mappe cognitive"],
  ["koffka", "Kurt Koffka", 1886, 1941, "psicologia", "Le leggi della percezione"],
  ["spitz", "René Spitz", 1887, 1974, "psicologia", "Gli organizzatori psichici e l'ospitalismo"],
  ["kohler", "Wolfgang Köhler", 1887, 1967, "psicologia", "L'insight: capire all'improvviso"],
  ["lewin", "Kurt Lewin", 1890, 1947, "psicologia", "La teoria del campo e la dinamica di gruppo"],
  ["annafreud", "Anna Freud", 1895, 1982, "psicologia", "I meccanismi di difesa e la psicoanalisi infantile"],
  ["winnicott", "Donald Winnicott", 1896, 1971, "psicologia", "La madre sufficientemente buona e l'oggetto transizionale"],
  ["heider", "Fritz Heider", 1896, 1988, "psicologia", "L'attribuzione: come spieghiamo il comportamento"],
  ["piaget", "Jean Piaget", 1896, 1980, "psicologia", "Gli stadi dello sviluppo cognitivo"],
  ["vygotskij", "Lev Vygotskij", 1896, 1934, "psicologia", "La zona di sviluppo prossimale"],
  ["allport", "Gordon Allport", 1897, 1967, "psicologia", "La natura del pregiudizio"],
  ["rogers", "Carl Rogers", 1902, 1987, "psicologia", "L'ascolto empatico e la terapia centrata sul cliente"],
  ["erikson", "Erik Erikson", 1902, 1994, "psicologia", "Gli stadi psicosociali"],
  ["lorenz", "Konrad Lorenz", 1903, 1989, "psicologia", "L'imprinting"],
  ["skinner", "B. F. Skinner", 1904, 1990, "psicologia", "Il condizionamento operante"],
  ["harlow", "Harry Harlow", 1905, 1981, "psicologia", "Il bisogno di contatto: gli esperimenti con le scimmie"],
  ["sherif", "Muzafer Sherif", 1906, 1988, "psicologia", "Le norme di gruppo e il conflitto tra gruppi"],
  ["bowlby", "John Bowlby", 1907, 1990, "psicologia", "La teoria dell'attaccamento"],
  ["asch", "Solomon Asch", 1907, 1996, "psicologia", "Il conformismo"],
  ["maslow", "Abraham Maslow", 1908, 1970, "psicologia", "La piramide dei bisogni"],
  ["ainsworth", "Mary Ainsworth", 1913, 1999, "psicologia", "La Strange Situation e gli stili di attaccamento"],
  ["bruner", "Jerome Bruner", 1915, 2016, "psicologia", "Lo scaffolding e la cultura dell'educazione"],
  ["bronfenbrenner", "Urie Bronfenbrenner", 1917, 2005, "psicologia", "Il modello ecologico dello sviluppo"],
  ["tajfel", "Henri Tajfel", 1919, 1982, "psicologia", "L'identità sociale"],
  ["festinger", "Leon Festinger", 1919, 1989, "psicologia", "La dissonanza cognitiva"],
  ["miller", "George A. Miller", 1920, 2012, "psicologia", "Il magico numero sette: la memoria a breve termine"],
  ["watzlawick", "Paul Watzlawick", 1921, 2007, "psicologia", "Gli assiomi della comunicazione"],
  ["bandura", "Albert Bandura", 1925, 2021, "psicologia", "L'apprendimento per osservazione"],
  ["kohlberg", "Lawrence Kohlberg", 1927, 1987, "psicologia", "Gli stadi dello sviluppo morale"],
  ["chomsky", "Noam Chomsky", 1928, null, "psicologia", "Il linguaggio innato e la grammatica universale"],
  ["neisser", "Ulric Neisser", 1928, 2012, "psicologia", "Il cognitivismo: la mente che elabora informazioni"],
  ["zimbardo", "Philip Zimbardo", 1933, 2024, "psicologia", "L'esperimento della prigione di Stanford"],
  ["rosenthal", "Robert Rosenthal", 1933, 2024, "psicologia", "L'effetto Pigmalione"],
  ["milgram", "Stanley Milgram", 1933, 1984, "psicologia", "L'obbedienza all'autorità"],
  ["seligman", "Martin Seligman", 1942, null, "psicologia", "L'impotenza appresa e la psicologia positiva"],
  ["gardner", "Howard Gardner", 1943, null, "psicologia", "Le intelligenze multiple"],
  ["goleman", "Daniel Goleman", 1946, null, "psicologia", "L'intelligenza emotiva"],
  ["comte-soc", "Auguste Comte", 1798, 1857, "sociologia", "Il fondatore della sociologia"],
  ["tocqueville", "Alexis de Tocqueville", 1805, 1859, "sociologia", "La democrazia in America e la tirannia della maggioranza"],
  ["marx-soc", "Karl Marx", 1818, 1883, "sociologia", "Le classi sociali e il conflitto"],
  ["spencer", "Herbert Spencer", 1820, 1903, "sociologia", "L'evoluzionismo sociale e la società come organismo"],
  ["pareto", "Vilfredo Pareto", 1848, 1923, "sociologia", "La circolazione delle élite"],
  ["tonnies", "Ferdinand Tönnies", 1855, 1936, "sociologia", "Comunità e società"],
  ["veblen", "Thorstein Veblen", 1857, 1929, "sociologia", "Il consumo vistoso"],
  ["simmel", "Georg Simmel", 1858, 1918, "sociologia", "La vita nella metropoli"],
  ["durkheim", "Émile Durkheim", 1858, 1917, "sociologia", "I fatti sociali, l'anomia, il suicidio"],
  ["gh-mead", "George H. Mead", 1863, 1931, "sociologia", "Il sé, l'io e il me"],
  ["weber", "Max Weber", 1864, 1920, "sociologia", "L'etica protestante e i tipi di potere"],
  ["park", "Robert E. Park", 1864, 1944, "sociologia", "La Scuola di Chicago e l'ecologia urbana"],
  ["horkheimer", "Max Horkheimer", 1895, 1973, "sociologia", "La teoria critica della società"],
  ["elias", "Norbert Elias", 1897, 1990, "sociologia", "Il processo di civilizzazione"],
  ["marcuse", "Herbert Marcuse", 1898, 1979, "sociologia", "L'uomo a una dimensione"],
  ["schutz", "Alfred Schütz", 1899, 1959, "sociologia", "La fenomenologia del mondo della vita quotidiana"],
  ["blumer", "Herbert Blumer", 1900, 1987, "sociologia", "L'interazionismo simbolico"],
  ["parsons", "Talcott Parsons", 1902, 1979, "sociologia", "Lo struttural-funzionalismo"],
  ["adorno", "Theodor W. Adorno", 1903, 1969, "sociologia", "L'industria culturale"],
  ["merton", "Robert K. Merton", 1910, 2003, "sociologia", "Funzioni manifeste e latenti; la profezia che si autoavvera"],
  ["mcluhan", "Marshall McLuhan", 1911, 1980, "sociologia", "Il medium è il messaggio"],
  ["wmills", "Charles Wright Mills", 1916, 1962, "sociologia", "L'élite del potere e l'immaginazione sociologica"],
  ["garfinkel", "Harold Garfinkel", 1917, 2011, "sociologia", "L'etnometodologia"],
  ["goffman", "Erving Goffman", 1922, 1982, "sociologia", "La vita quotidiana come rappresentazione"],
  ["bauman", "Zygmunt Bauman", 1925, 2017, "sociologia", "La modernità liquida"],
  ["foucault-soc", "Michel Foucault", 1926, 1984, "sociologia", "Potere, sorveglianza e istituzioni"],
  ["luhmann", "Niklas Luhmann", 1927, 1998, "sociologia", "La società come sistema"],
  ["becker", "Howard S. Becker", 1928, 2023, "sociologia", "Outsiders: la teoria dell'etichettamento"],
  ["habermas-soc", "Jürgen Habermas", 1929, 2026, "sociologia", "L'agire comunicativo e la sfera pubblica"],
  ["berger", "Peter L. Berger", 1929, 2017, "sociologia", "La costruzione sociale della realtà"],
  ["dahrendorf", "Ralf Dahrendorf", 1929, 2009, "sociologia", "Il conflitto nella società moderna"],
  ["bourdieu", "Pierre Bourdieu", 1930, 2002, "sociologia", "L'habitus e il capitale culturale"],
  ["giddens", "Anthony Giddens", 1938, null, "sociologia", "La terza via e le conseguenze della modernità"],
  ["castells", "Manuel Castells", 1942, null, "sociologia", "La società in rete"],
  ["ubeck", "Ulrich Beck", 1944, 2015, "sociologia", "La società del rischio"],
  ["morgan", "Lewis H. Morgan", 1818, 1881, "antropologia", "L'evoluzionismo culturale"],
  ["tylor", "Edward B. Tylor", 1832, 1917, "antropologia", "La prima definizione di cultura"],
  ["frazer", "James Frazer", 1854, 1941, "antropologia", "Il ramo d'oro: magia, religione, scienza"],
  ["levybruhl", "Lucien Lévy-Bruhl", 1857, 1939, "antropologia", "La mentalità primitiva"],
  ["boas", "Franz Boas", 1858, 1942, "antropologia", "Il relativismo culturale"],
  ["mauss", "Marcel Mauss", 1872, 1950, "antropologia", "Il dono"],
  ["vangennep", "Arnold van Gennep", 1873, 1957, "antropologia", "I riti di passaggio"],
  ["radcliffebrown", "Alfred Radcliffe-Brown", 1881, 1955, "antropologia", "Lo struttural-funzionalismo"],
  ["malinowski", "Bronisław Malinowski", 1884, 1942, "antropologia", "L'osservazione partecipante"],
  ["benedict", "Ruth Benedict", 1887, 1948, "antropologia", "Modelli di cultura"],
  ["white", "Leslie White", 1900, 1975, "antropologia", "Il neoevoluzionismo: cultura ed energia"],
  ["mead", "Margaret Mead", 1901, 1978, "antropologia", "Cultura e adolescenza a Samoa"],
  ["evanspritchard", "Edward Evans-Pritchard", 1902, 1973, "antropologia", "Stregoneria e ordine tra gli Azande e i Nuer"],
  ["steward", "Julian Steward", 1902, 1972, "antropologia", "L'ecologia culturale"],
  ["bateson", "Gregory Bateson", 1904, 1980, "antropologia", "Il doppio legame e l'ecologia della mente"],
  ["levistrauss", "Claude Lévi-Strauss", 1908, 2009, "antropologia", "Lo strutturalismo"],
  ["demartino", "Ernesto de Martino", 1908, 1965, "antropologia", "La crisi della presenza e il Sud Italia"],
  ["vturner", "Victor Turner", 1920, 1983, "antropologia", "La liminalità e i drammi sociali"],
  ["mdouglas", "Mary Douglas", 1921, 2007, "antropologia", "Purezza e pericolo"],
  ["geertz", "Clifford Geertz", 1926, 2006, "antropologia", "L'antropologia interpretativa"],
  ["mharris", "Marvin Harris", 1927, 2001, "antropologia", "Il materialismo culturale"],
  ["auge", "Marc Augé", 1935, 2023, "antropologia", "I nonluoghi"],
  ["appadurai", "Arjun Appadurai", 1949, null, "antropologia", "La globalizzazione e i panorami culturali"]
];

/* Correnti e scuole: [nome, periodo, idea in una frase, autori] */
const FILO_CORRENTI = [
  ["I primi filosofi (naturalisti)", "VI sec. a.C.", "Cercano l'archè: il principio da cui nasce tutto.", ["talete", "anassimandro", "anassimene", "pitagora", "eraclito"]],
  ["Gli Eleati", "V sec. a.C.", "L'essere è uno, eterno e immobile: il cambiamento è un'illusione.", ["parmenide", "zenone-elea"]],
  ["I fisici pluralisti", "V sec. a.C.", "Spiegano il cambiamento con più elementi che si uniscono e si separano.", ["empedocle", "anassagora", "democrito"]],
  ["I Sofisti", "V sec. a.C.", "Insegnano l'arte di parlare: la verità dipende dall'uomo.", ["protagora", "gorgia"]],
  ["I grandi classici", "V-IV sec. a.C.", "Dal dialogo socratico alle idee di Platone alla sostanza di Aristotele.", ["socrate", "platone", "aristotele"]],
  ["Le scuole ellenistiche", "IV-III sec. a.C.", "La filosofia come via per vivere sereni.", ["epicuro", "zenone-cizio"]],
  ["Neoplatonismo", "III sec.", "Tutto deriva dall'Uno e all'Uno ritorna.", ["plotino"]],
  ["Patristica e Scolastica", "IV-XIV sec.", "Accordare la fede cristiana con la ragione.", ["agostino", "anselmo", "tommaso", "ockham"]],
  ["Rinascimento e rivoluzione scientifica", "XV-XVII sec.", "L'uomo al centro; la natura si studia con esperimenti e matematica.", ["machiavelli", "bruno", "bacone", "galilei"]],
  ["Razionalismo", "XVII sec.", "La conoscenza vera viene dalla ragione.", ["cartesio", "spinoza", "leibniz"]],
  ["Empirismo", "XVII-XVIII sec.", "La conoscenza viene dall'esperienza dei sensi.", ["locke", "berkeley", "hume"]],
  ["Pensiero politico moderno", "XVI-XVIII sec.", "Come nasce lo Stato e che limiti ha il potere.", ["machiavelli", "hobbes", "locke", "montesquieu", "rousseau"]],
  ["Illuminismo", "XVIII sec.", "Avere il coraggio di usare la propria ragione.", ["voltaire", "montesquieu", "rousseau", "kant"]],
  ["Criticismo", "fine XVIII sec.", "Prima di conoscere, bisogna capire i limiti della ragione.", ["kant"]],
  ["Idealismo tedesco", "inizio XIX sec.", "La realtà è opera dello spirito o dell'Io.", ["fichte", "schelling", "hegel"]],
  ["Critici di Hegel", "XIX sec.", "Al centro non lo spirito, ma l'individuo, la volontà, l'uomo concreto.", ["schopenhauer", "kierkegaard", "feuerbach", "marx"]],
  ["Positivismo", "XIX sec.", "Solo la scienza dà conoscenze certe e porta progresso.", ["comte", "mill"]],
  ["Maestri del sospetto", "XIX-XX sec.", "Dietro ciò che pensiamo ci sono forze nascoste: economia, volontà, inconscio.", ["marx", "nietzsche", "freud"]],
  ["Fenomenologia ed esistenzialismo", "XX sec.", "Partire dall'esperienza vissuta e dall'esistenza concreta.", ["husserl", "heidegger", "sartre", "beauvoir"]],
  ["Filosofia della scienza e del linguaggio", "XX sec.", "Che cosa rende scientifica una teoria? Che cosa si può dire?", ["wittgenstein", "popper"]],
  ["Etica e politica del Novecento", "XX sec.", "Il male, la libertà, la responsabilità verso il futuro.", ["arendt", "jonas", "beauvoir"]]
];
const UMANE_CORRENTI = [
  ["Antichità e Umanesimo", "I-XVI sec.", "Educare tutta la persona, con dolcezza e rispetto per l'allievo.", ["quintiliano", "vittorino", "erasmo", "montaigne", "calasanzio"], "Umanesimo"],
  ["Pedagogia moderna: le origini", "XVII-XIX sec.", "L'educazione segue la natura del bambino e diventa una scienza.", ["comenio", "locke-ped", "rousseau-ped", "pestalozzi", "frobel", "herbart"], "Origini moderne"],
  ["Pedagogia italiana dell'Ottocento", "XIX sec.", "Scuola, libertà, fede e popolo: educare gli italiani.", ["aporti", "lambruschini", "rosmini", "bosco", "gabelli"], "Ottocento italiano"],
  ["Attivismo pedagogico", "inizio XX sec.", "Il bambino impara facendo, al centro c'è il suo interesse.", ["dewey", "claparede", "decroly", "kerschensteiner", "montessori", "agazzi", "pizzigoni", "freinet", "neill"], "Attivismo"],
  ["Idealismo e personalismo", "XX sec.", "L'educazione forma lo spirito e la persona, non solo l'individuo.", ["gentile-ped", "lombardoradice", "maritain"], "Idealismo e personalismo"],
  ["Educazione e società", "XX sec.", "Si educa dentro il collettivo e per cambiare la società.", ["makarenko", "gramsci-ped"], "Educazione e società"],
  ["Pedagogia critica e democratica", "seconda metà XX sec.", "La scuola deve liberare, includere chi è svantaggiato e dare la parola a tutti.", ["freire", "milani", "illich", "lodi", "rodari"], "Pedagogia critica"],
  ["Pedagogia contemporanea", "fine XX sec.", "Obiettivi chiari, intelligenze diverse, pensiero complesso.", ["bloom", "bruner", "gardner", "morin"], "Contemporanea"],
  ["Le origini: strutturalismo e funzionalismo", "fine XIX sec.", "La mente si studia con il metodo sperimentale: i suoi elementi o le sue funzioni.", ["wundt", "ebbinghaus", "titchener", "james"], "Origini"],
  ["Comportamentismo", "XX sec.", "Si studia solo il comportamento osservabile: stimolo, risposta, rinforzo.", ["pavlov", "thorndike", "watson", "tolman", "skinner", "bandura"], "Comportamentismo"],
  ["Gestalt", "XX sec.", "Percepiamo forme intere, non parti separate; si impara anche per intuizione improvvisa.", ["wertheimer", "koffka", "kohler", "lewin"], "Gestalt"],
  ["Psicoanalisi e scuole dopo Freud", "XX sec.", "L'inconscio guida la vita psichica; gli allievi di Freud ne cambiano alcune idee.", ["freud-psi", "adler", "jung", "erikson"], "Psicoanalisi"],
  ["Psicoanalisi dell'infanzia", "XX sec.", "Le prime relazioni del bambino con chi lo cura formano la sua personalità.", ["annafreud", "klein", "spitz", "winnicott"], "Psicoanalisi infantile"],
  ["Etologia e attaccamento", "XX sec.", "Il legame con chi si prende cura di noi è un bisogno di base, come il cibo.", ["lorenz", "harlow", "bowlby", "ainsworth"], "Attaccamento"],
  ["Cognitivismo e costruttivismo", "XX sec.", "La mente elabora informazioni; il bambino costruisce la conoscenza, da solo e con gli altri.", ["piaget", "vygotskij", "bruner", "miller", "neisser", "chomsky", "gardner"], "Cognitivismo"],
  ["Sviluppo: emozioni, morale, ambiente", "XX sec.", "Si cresce per tappe, dentro relazioni e ambienti che si influenzano a vicenda.", ["wallon", "erikson", "kohlberg", "bronfenbrenner"], "Sviluppo"],
  ["Psicologia umanistica", "metà XX sec.", "Al centro la persona, i suoi bisogni e la sua spinta a realizzarsi.", ["maslow", "rogers"], "Umanistica"],
  ["Psicologia sociale", "XX sec.", "Come gli altri, i gruppi e le situazioni cambiano ciò che pensiamo e facciamo.", ["lewin", "allport", "heider", "sherif", "asch", "festinger", "tajfel", "milgram", "zimbardo", "rosenthal"], "Sociale"],
  ["Comunicazione", "seconda metà XX sec.", "Ogni comportamento comunica: non si può non comunicare.", ["watzlawick"], "Comunicazione"],
  ["Emozioni e benessere", "fine XX sec.", "Anche le emozioni e l'ottimismo si possono capire e allenare.", ["goleman", "seligman", "gardner"], "Emozioni"],
  ["Sociologia classica", "XIX-XX sec.", "Nasce la scienza della società: ordine, progresso, conflitto, comunità.", ["tocqueville", "comte-soc", "spencer", "marx-soc", "durkheim", "tonnies", "simmel", "weber", "pareto", "veblen"], "Classici"],
  ["Funzionalismo sociologico", "XX sec.", "Ogni parte della società ha una funzione per l'insieme.", ["durkheim", "parsons", "merton", "luhmann"], "Funzionalismo"],
  ["Scuola di Chicago e interazionismo", "XX sec.", "La società nasce dalle interazioni quotidiane e dai significati che diamo alle cose.", ["park", "gh-mead", "blumer", "goffman", "becker"], "Interazionismo"],
  ["Fenomenologia e costruzione sociale", "XX sec.", "La realtà sociale è costruita dalle persone nella vita di ogni giorno.", ["schutz", "berger", "garfinkel"], "Costruzione sociale"],
  ["Scuola di Francoforte", "XX sec.", "La teoria critica: la società di massa può togliere libertà.", ["horkheimer", "adorno", "marcuse", "habermas-soc"], "Francoforte"],
  ["Conflitto e potere", "XX sec.", "Chi ha il potere, come lo esercita e come la società lo riproduce.", ["marx-soc", "wmills", "dahrendorf", "foucault-soc", "bourdieu"], "Conflitto e potere"],
  ["Media e comunicazione", "XX sec.", "I mezzi di comunicazione cambiano il modo di pensare e di vivere insieme.", ["mcluhan", "adorno", "castells"], "Media"],
  ["Modernità e società contemporanea", "XX-XXI sec.", "La società cambia in fretta: rischio, globalizzazione, legami più fragili.", ["elias", "giddens", "ubeck", "bauman", "castells"], "Contemporanea"],
  ["Evoluzionismo culturale", "XIX sec.", "Le culture passano per stadi, dal semplice al complesso.", ["morgan", "tylor", "frazer"], "Evoluzionismo"],
  ["Mentalità e riti", "inizio XX sec.", "Come i popoli pensano il mondo e segnano i passaggi della vita.", ["levybruhl", "vangennep", "vturner", "mdouglas"], "Riti e simboli"],
  ["Relativismo e particolarismo", "XX sec.", "Ogni cultura va capita dal suo interno.", ["boas", "benedict", "mead"], "Relativismo"],
  ["Funzionalismo e strutturalismo", "XX sec.", "Le istituzioni rispondono a bisogni; dietro le culture ci sono strutture comuni.", ["malinowski", "radcliffebrown", "evanspritchard", "mauss", "levistrauss"], "Funzionalismo e strutturalismo"],
  ["Neoevoluzionismo e materialismo", "XX sec.", "Ambiente, tecnologia ed economia spiegano le differenze tra le culture.", ["white", "steward", "mharris"], "Materialismo"],
  ["Antropologia interpretativa e italiana", "XX sec.", "La cultura come testo da interpretare; la crisi della presenza.", ["geertz", "demartino", "bateson"], "Interpretativa"],
  ["Antropologia della contemporaneità", "fine XX-XXI sec.", "Luoghi, migrazioni e media nel mondo globale.", ["auge", "appadurai"], "Contemporaneità"]
];

/* ---------- LETTERATURA LATINA ---------- */
const LAT_ETA = [
  { id: "arcaica", short: "Età arcaica", name: "Età arcaica", from: -240, to: -78, desc: "Dalle prime opere alla crisi della repubblica: teatro, epica, prosa", c: "pink", school: "di solito in terza" },
  { id: "cesare", short: "Età di Cesare", name: "Età di Cesare", from: -78, to: -44, desc: "Le guerre civili: poesia nuova, filosofia, oratoria, storiografia", c: "sky", school: "di solito in quarta" },
  { id: "augustea", short: "Età augustea", name: "Età augustea", from: -43, to: 14, desc: "La pace di Augusto e i grandi poeti", c: "mint", school: "di solito in quarta" },
  { id: "giulioclaudia", short: "Giulio-Claudi", name: "Età giulio-claudia", from: 14, to: 68, desc: "Da Tiberio a Nerone: intellettuali e potere", c: "yellow", school: "di solito in quinta" },
  { id: "flavia", short: "Flavi", name: "Età dei Flavi", from: 69, to: 96, desc: "Vespasiano, Tito, Domiziano: scienza, retorica, epigramma", c: "lilac", school: "di solito in quinta" },
  { id: "antonini", short: "Traiano e Antonini", name: "Da Traiano agli Antonini", from: 96, to: 192, desc: "Il principato adottivo: storiografia, satira, romanzo", c: "sky", school: "di solito in quinta" },
  { id: "tarda", short: "Tarda antichità", name: "Tarda antichità e letteratura cristiana", from: 192, to: 476, desc: "I Padri della Chiesa e la fine dell'impero d'Occidente", c: "mint", school: "di solito in quinta" }
];
const LATINI = [
  ["livioandronico", "Livio Andronico", -280, -200, "arcaica", "L'Odusia: la prima traduzione dell'Odissea"],
  ["nevio", "Gneo Nevio", -270, -201, "arcaica", "Il Bellum Poenicum, primo poema epico romano"],
  ["plauto", "Plauto", -254, -184, "arcaica", "La commedia della beffa e del servo astuto"],
  ["ennio", "Quinto Ennio", -239, -169, "arcaica", "Gli Annales, padre della poesia latina"],
  ["catone", "Catone il Censore", -234, -149, "arcaica", "Il mos maiorum e le Origines"],
  ["terenzio", "Terenzio", -185, -159, "arcaica", "La commedia dell'humanitas"],
  ["cicerone", "Marco Tullio Cicerone", -106, -43, "cesare", "L'oratoria, la filosofia e le lettere"],
  ["cesare", "Gaio Giulio Cesare", -100, -44, "cesare", "I Commentarii: la guerra raccontata da chi la fa"],
  ["nepote", "Cornelio Nepote", -100, -27, "cesare", "Le biografie degli uomini illustri"],
  ["lucrezio", "Lucrezio", -94, -55, "cesare", "De rerum natura: liberarsi dalla paura"],
  ["sallustio", "Sallustio", -86, -35, "cesare", "La monografia storica: Catilina e Giugurta"],
  ["catullo", "Catullo", -84, -54, "cesare", "I carmi per Lesbia e la poesia dei neòteroi"],
  ["virgilio", "Virgilio", -70, -19, "augustea", "Bucoliche, Georgiche, Eneide"],
  ["orazio", "Orazio", -65, -8, "augustea", "Il carpe diem e l'aurea mediocritas"],
  ["livio", "Tito Livio", -59, 17, "augustea", "Ab urbe condita: la storia di Roma"],
  ["tibullo", "Tibullo", -55, -19, "augustea", "L'elegia e il sogno della vita in campagna"],
  ["properzio", "Properzio", -50, -15, "augustea", "L'elegia d'amore per Cinzia"],
  ["ovidio", "Ovidio", -43, 17, "augustea", "Le Metamorfosi e l'arte di amare"],
  ["fedro", "Fedro", -20, 50, "giulioclaudia", "Le favole"],
  ["seneca", "Seneca", -4, 65, "giulioclaudia", "La filosofia per vivere: le Lettere a Lucilio"],
  ["petronio", "Petronio", 27, 66, "giulioclaudia", "Il Satyricon"],
  ["persio", "Persio", 34, 62, "giulioclaudia", "La satira morale"],
  ["lucano", "Lucano", 39, 65, "giulioclaudia", "Il Bellum civile: l'epica senza dèi"],
  ["pliniovecchio", "Plinio il Vecchio", 23, 79, "flavia", "La Naturalis historia"],
  ["quintiliano-lat", "Quintiliano", 35, 96, "flavia", "L'Institutio oratoria"],
  ["marziale", "Marziale", 40, 104, "flavia", "Gli epigrammi"],
  ["stazio", "Stazio", 45, 96, "flavia", "La Tebaide e le Silvae"],
  ["giovenale", "Giovenale", 55, 127, "antonini", "La satira dell'indignazione"],
  ["tacito", "Tacito", 55, 120, "antonini", "Annales, Historiae, Germania, Agricola"],
  ["pliniogiovane", "Plinio il Giovane", 61, 113, "antonini", "L'epistolario e il Panegirico di Traiano"],
  ["svetonio", "Svetonio", 69, 122, "antonini", "Le vite dei Cesari"],
  ["apuleio", "Apuleio", 125, 170, "antonini", "Le Metamorfosi (L'asino d'oro)"],
  ["ambrogio", "Ambrogio", 340, 397, "tarda", "Gli inni e il vescovo di Milano"],
  ["girolamo", "Girolamo", 347, 420, "tarda", "La Vulgata: la Bibbia in latino"],
  ["agostino-lat", "Agostino", 354, 430, "tarda", "Le Confessioni e La città di Dio"]
];
/* generi letterari: [nome, periodo, idea, autori, nome breve] */
const LAT_GENERI = [
  ["Teatro: commedia e tragedia", "III sec. a.C. – I sec. d.C.", "La commedia fa ridere di tipi umani; la tragedia mette in scena le passioni.", ["livioandronico", "nevio", "plauto", "terenzio", "seneca"], "Teatro"],
  ["Epica", "III sec. a.C. – I sec. d.C.", "Il racconto in versi delle imprese e delle origini di Roma.", ["livioandronico", "nevio", "ennio", "virgilio", "ovidio", "lucano", "stazio"], "Epica"],
  ["Lirica ed elegia", "I sec. a.C.", "La poesia dei sentimenti personali: l'amore, l'amicizia, il tempo che passa.", ["catullo", "orazio", "tibullo", "properzio", "ovidio"], "Lirica ed elegia"],
  ["Poesia didascalica", "I sec. a.C.", "Poesia che insegna: la natura, l'agricoltura, l'amore.", ["lucrezio", "virgilio", "ovidio"], "Didascalica"],
  ["Storiografia e biografia", "II sec. a.C. – II sec. d.C.", "Raccontare la storia di Roma e la vita dei grandi uomini.", ["catone", "cesare", "nepote", "sallustio", "livio", "tacito", "svetonio"], "Storiografia"],
  ["Oratoria e retorica", "I sec. a.C. – I sec. d.C.", "L'arte di parlare in pubblico e di convincere.", ["cicerone", "quintiliano-lat", "pliniogiovane"], "Oratoria"],
  ["Filosofia", "I sec. a.C. – I sec. d.C.", "Portare a Roma il pensiero greco e usarlo per vivere bene.", ["lucrezio", "cicerone", "seneca"], "Filosofia"],
  ["Satira ed epigramma", "I sec. a.C. – II sec. d.C.", "Criticare con ironia i vizi della società.", ["orazio", "persio", "marziale", "giovenale"], "Satira"],
  ["Romanzo", "I-II sec. d.C.", "Storie in prosa piene di avventure, magia e personaggi popolari.", ["petronio", "apuleio"], "Romanzo"],
  ["Favola", "I sec. d.C.", "Brevi racconti di animali con una morale.", ["fedro"], "Favola"],
  ["Epistolografia", "I sec. a.C. – II sec. d.C.", "Le lettere: vita privata, politica e filosofia.", ["cicerone", "seneca", "pliniogiovane"], "Lettere"],
  ["Scienza ed enciclopedia", "I sec. d.C.", "Raccogliere tutto il sapere sulla natura.", ["pliniovecchio"], "Scienza"],
  ["Letteratura cristiana", "IV-V sec.", "La fede cristiana incontra la cultura latina.", ["ambrogio", "girolamo", "agostino-lat"], "Cristiana"]
];

const yearTxt = (y) => y == null ? "vivente" : y < 0 ? `${-y} a.C.` : String(y);
const lifeTxt = (a, b) => b == null ? `nato nel ${yearTxt(a)}` : a < 0 && b < 0 ? `ca. ${-a}–${-b} a.C.` : a < 0 ? `${-a} a.C. – ${b} d.C.` : `${a}–${b}`;

/* =========================================================
   2. ISTRUZIONI PER L'IA
   ========================================================= */
const AUTORE_PROMPTS = {
  scheda: (nome, materia, vita, fonte, extra = "") => `${extra ? extra + "\n" : ""}Prepara una scheda di studio su ${nome} (${vita}) per una studentessa di quarta del liceo delle scienze umane con dislessia, materia: ${materia}.
Livello: quello di un buon manuale di liceo (quarto-quinto anno). La dislessia riguarda la lettura, non la comprensione: frasi chiare (fino a 25 parole), ma contenuti completi e precisi, con i termini tecnici originali (spiegati) e le argomentazioni dell'autore. Solo informazioni corrette e verificabili.
${fonte ? `Basati sulla VOCE DI WIKIPEDIA riportata in fondo: prendi da lì date, opere, concetti e nomi. Puoi semplificare e riordinare, ma non contraddirla.
Se un'informazione non è nella voce, aggiungila solo se ne sei assolutamente sicuro; altrimenti lasciala fuori. Non inventare frasi celebri: se non sei certo che sia autentica, scrivi "frase": null.` : `Se non sei sicuro di un dato (anno, titolo, frase celebre), lascialo fuori. Non inventare frasi celebri: se non sei certo, scrivi "frase": null.`}
Rispondi SOLO con JSON:
{"in_breve": "2-3 frasi: chi è, la sua tesi centrale, perché è importante",
 "contesto": "2-4 frasi sul periodo storico, sulla cultura del tempo e sul problema che affronta",
 "vita": ["4-6 fatti della vita con le date, utili a capire il pensiero"],
 "opere": [{"titolo": "...", "anno": "...", "di_cosa_parla": "1-2 frasi sul contenuto e sulle tesi principali"}],
 "pensiero": [{"titolo": "idea chiave in 3-7 parole", "spiegazione": "3-5 frasi: il concetto, l'argomentazione dell'autore, i termini tecnici, eventuali esempi o differenze con altri autori"}],
 "parole": [{"parola": "termine tecnico (anche nella lingua originale, se si usa)", "significato": "definizione precisa, come la chiederebbe l'insegnante"}],
 "esempio": "un esempio di vita quotidiana per capire l'idea più importante",
 "collegamenti": [{"autore": "nome", "rapporto": "in cosa è d'accordo o in disaccordo"}],
 "frase": {"testo": "una frase celebre (tradotta in italiano)", "spiegazione": "cosa vuol dire"},
 "attualita": "1-2 frasi: perché è ancora utile oggi",
 "domande": ["3 domande tipiche da interrogazione"]}
Da 6 a 10 punti in "pensiero", da 6 a 12 "parole", da 3 a 5 "collegamenti", da 2 a 6 "opere", 4 "domande" (di esposizione, spiegazione e collegamento, livello liceo).${fonte ? `

VOCE DI WIKIPEDIA («${fonte.title}»):
"""${fonte.text}"""` : ""}`,
  confronta: (a, b, materia) => `Confronta ${a} e ${b} (${materia}) per una studentessa delle superiori con dislessia.
Rispondi SOLO con JSON: {"titolo": "${a} e ${b} a confronto", "colonne": ["${a}", "${b}"], "righe": [{"aspetto": "...", "valori": ["...", "..."]}], "in_comune": "una frase su cosa hanno in comune", "differenza": "una frase sulla differenza più importante"}
Da 7 a 10 righe (es. periodo e contesto, problema principale, tesi centrale, metodo, conoscenza, etica o politica, concetto dell'uomo e della società, opere principali, eredità). Celle precise (fino a 25 parole), con i concetti e i termini propri di ciascun autore, mai generiche; contenuti corretti, livello liceo.`,
  chat: (nome, vita, storia, domanda) => `Interpreta ${nome} (${vita}) che risponde alle domande di una studentessa italiana delle superiori, per aiutarla a capire il suo pensiero.
Regole:
- parla in prima persona, in italiano chiaro, con frasi non troppo lunghe; da 120 a 220 parole;
- resta fedele a ciò che ${nome} ha davvero pensato e scritto; usa i suoi concetti e i suoi termini (spiegandoli), cita le opere in cui li hai sviluppati e, se serve, la differenza con altri autori;
- se la domanda riguarda cose nate dopo la tua epoca, rispondi ragionando con le tue idee e dillo chiaramente ("Ai miei tempi non esisteva, ma penso che...");
- se non sai o la domanda è fuori tema, dillo con gentilezza e riporta il discorso sul tuo pensiero;
- non inventare citazioni.
${storia ? "Conversazione finora:\n" + storia + "\n" : ""}
Domanda della studentessa: ${domanda}
Rispondi solo con il testo della risposta.`,
  quiz: (nome, scheda) => `Prepara un quiz a scelta multipla su ${nome} per una studentessa delle superiori con dislessia.
Rispondi SOLO con JSON: {"domande": [{"domanda": "...", "opzioni": ["...", "...", "...", "..."], "giusta": 0, "spiegazione": "perché è giusta, in una frase"}]}
Regole: 8 domande di livello liceo sui concetti più importanti: comprensione delle idee, definizioni dei termini, opere, collegamenti con altri autori (non solo date);
4 opzioni (fino a 18 parole), una sola giusta; le sbagliate devono essere PLAUSIBILI (per esempio concetti di autori vicini o errori tipici degli studenti), ma senza ambiguità;
"giusta" è l'indice (0-3) dell'opzione corretta, varia la posizione; frasi chiare, niente doppie negazioni; la spiegazione dice perché la giusta è giusta e, se utile, perché la più "tentatrice" è sbagliata.
Basati su questa scheda:
${scheda}`,
  concetto: (concetto, materia) => `Spiega il concetto "${concetto}" (${materia}) a una studentessa di quarta superiore con dislessia.
Livello liceo: chiaro nella forma, rigoroso nel contenuto.
Formato:
## Definizione
(una definizione precisa, come la chiederebbe l'insegnante)
## Spiegato meglio
- (5-8 punti: significato, origine, autori che lo usano e come lo intendono, opere, eventuali evoluzioni del concetto)
## Un esempio
(un esempio concreto che lo rende chiaro)
## Collegamenti
- (con altri concetti, autori o materie)
## Non confonderlo con
- (1-3 concetti simili e la differenza precisa)
Parole chiave in **grassetto**. Frasi fino a 25 parole.`
};

/* =========================================================
   3. LA SEZIONE (una per materia, stesso funzionamento)
   ========================================================= */
const SUBJECTS = {
  filo: { title: "Filosofia", materia: "filosofia", correnti: FILO_CORRENTI, lineDefault: "moderna", intro: "I filosofi in ordine di tempo. Tocca un nome per aprire la sua scheda: vita, pensiero, parole chiave, collegamenti.",
    list: FILOSOFI, groups: FILO_PERIODS, groupLabel: "Periodo" },
  umane: { title: "Scienze umane", materia: "scienze umane", correnti: UMANE_CORRENTI, lineDefault: "", intro: "Pedagogia, psicologia, sociologia e antropologia: gli autori principali, le loro idee e i collegamenti.",
    list: UMANE, groups: UMANE_AREAS, groupLabel: "Disciplina" },
  latino: { title: "Letteratura latina", materia: "letteratura latina", correnti: LAT_GENERI, correntiLabel: "Generi", lineDefault: "", intro: "Gli autori latini per età. Tocca un nome per la scheda: vita, opere, temi e stile, una frase in latino e le domande da interrogazione.",
    list: LATINI, groups: LAT_ETA, groupLabel: "Età", pensieroLabel: "Temi e stile", role: "scrittore latino",
    extra: `È un autore di letteratura latina: in "pensiero" metti i temi principali e le caratteristiche dello stile (4-6 punti); in "opere" le opere principali con il titolo latino e la traduzione italiana; in "frase" una citazione celebre AUTENTICA con il testo latino nel campo "latino" e la traduzione nel campo "testo"; in "collegamenti" altri autori latini o greci e, se c'è, un collegamento con la letteratura italiana.` }
};

const autori = {
  state: {},
  init() {
    for (const key of Object.keys(SUBJECTS)) this.build(key);
  },

  find(key, id) {
    const a = SUBJECTS[key].list.find(x => x[0] === id);
    return a && { id: a[0], name: a[1], from: a[2], to: a[3], group: a[4], tag: a[5] };
  },
  groupOf(key, gid) { return SUBJECTS[key].groups.find(g => g.id === gid); },
  materiaOf(key, a) { return key === "umane" ? this.groupOf(key, a.group).name.toLowerCase() : SUBJECTS[key].materia; },

  build(key) {
    const S = SUBJECTS[key];
    const root = $(`#view-${key} .subject-body`);
    const opts = S.list.slice().sort((a, b) => a[2] - b[2]).map(a => `<option value="${a[0]}">${escapeHtml(a[1])}</option>`).join("");
    root.innerHTML = `
      <div class="intro"><h1>${S.title}</h1><p>${S.intro}</p></div>
      <div class="seg scroll" data-sub="${key}">
        <button data-pane="autori" class="on">${icon("timeline")}Autori</button>
        <button data-pane="correnti">${icon("layers")}${S.correntiLabel || "Correnti"}</button>
        <button data-pane="confronta">${icon("columns")}Confronta</button>
        <button data-pane="chiedi">${icon("chat")}Chiedi all'autore</button>
        <button data-pane="concetto">${icon("bulb")}Concetti</button>
        <button data-pane="glossario">${icon("key")}Glossario</button>
      </div>
      <div class="au-pane" data-p="autori">
        <div class="card">
          <div class="au-view-switch"><button class="chip on" data-v="list">Elenco</button><button class="chip" data-v="line">Linea del tempo</button></div>
          <input type="search" class="au-search" placeholder="Cerca un autore" aria-label="Cerca un autore">
          <div class="chips au-groups">${[["", "Tutti"], ...S.groups.map(g => [g.id, g.short || g.name])].map(([v, l]) => `<button class="chip${v ? "" : " on"}" data-g="${v}">${escapeHtml(l)}</button>`).join("")}</div>
          <div class="chips au-schools hidden" aria-label="Scuola"></div>
          <div class="au-list"></div>
        </div>
      </div>
      <div class="au-pane hidden" data-p="scheda"><div class="card au-card"></div><div class="card au-quiz hidden"></div></div>
      <div class="au-pane hidden" data-p="correnti">
        <div class="card">
          <h2>${S.correntiLabel ? "Generi letterari" : "Correnti e scuole"}</h2>
          <p class="hint">${S.correntiLabel ? "Gli autori raggruppati per genere: epica, lirica, storiografia… Tocca un nome per aprire la sua scheda." : "Gli autori raggruppati per modo di pensare. Tocca un nome per aprire la sua scheda."}</p>
          <div class="au-correnti"></div>
        </div>
        <div class="card hidden au-corr-out"></div>
      </div>
      <div class="au-pane hidden" data-p="glossario">
        <div class="card">
          <h2>Glossario</h2>
          <p class="hint">Raccoglie da solo le parole chiave delle schede che hai aperto. Più schede apri, più cresce.</p>
          <input type="search" class="au-gsearch" placeholder="Cerca una parola" aria-label="Cerca una parola">
          <div class="au-glossary"></div>
        </div>
      </div>
      <div class="au-pane hidden" data-p="confronta">
        <div class="card">
          <h2>Confronta due autori</h2>
          <p class="hint">Una tabella con somiglianze e differenze: perfetta per l'interrogazione.</p>
          <div class="au-pair"><select class="au-a" aria-label="Primo autore">${opts}</select><span>e</span><select class="au-b" aria-label="Secondo autore">${opts}</select></div>
          <div class="btn-row"><button class="btn primary au-cmp">${icon("columns")}Confronta</button></div>
        </div>
        <div class="card hidden au-cmp-out"></div>
      </div>
      <div class="au-pane hidden" data-p="chiedi">
        <div class="card">
          <h2>Fai una domanda all'autore</h2>
          <p class="hint">Risponde in prima persona, in modo semplice e fedele al suo pensiero. È una simulazione: per le verifiche controlla sempre sul libro.</p>
          <select class="au-chat-who" aria-label="Autore">${opts}</select>
          <div class="chat"></div>
          <div class="chips au-starters"></div>
          <div class="chat-input">
            <textarea rows="2" class="au-q" placeholder="Scrivi o detta la tua domanda"></textarea>
            <button class="ask-mic au-mic" aria-label="Detta la domanda">${icon("mic")}</button>
          </div>
          <div class="mic-status au-mic-st"></div>
          <div class="btn-row"><button class="btn primary au-send">${icon("chat")}Chiedi</button><button class="btn ghost au-reset">Nuova conversazione</button></div>
        </div>
      </div>
      <div class="au-pane hidden" data-p="concetto">
        <div class="card">
          <h2>Non ti è chiaro un concetto?</h2>
          <p class="hint">Scrivi una parola o un'idea, anche con l'autore. Esempi: ${key === "filo" ? "«trascendentale in Kant», «dialettica», «empirismo»" : "«zona di sviluppo prossimale», «anomia», «relativismo culturale»"}.</p>
          <div class="topic-row"><input type="text" class="au-concept" placeholder="Il concetto"><button class="btn primary au-explain">Spiegamelo</button></div>
        </div>
        <div class="card hidden au-concept-out"></div>
      </div>`;
    this.state[key] = { group: "", q: "", chat: [], current: null };
    this.renderList(key);
    // eventi
    root.querySelector(".seg").addEventListener("click", (e) => { const b = e.target.closest("[data-pane]"); if (b) this.pane(key, b.dataset.pane); });
    root.querySelector(".au-search").addEventListener("input", (e) => { this.state[key].q = e.target.value.trim().toLowerCase(); this.renderList(key); });
    root.querySelector(".au-groups").addEventListener("click", (e) => {
      const c = e.target.closest("[data-g]"); if (!c) return;
      this.state[key].group = c.dataset.g;
      this.state[key].school = "";
      root.querySelectorAll(".au-groups .chip").forEach(x => x.classList.toggle("on", x === c));
      this.renderSchools(key);
      this.renderList(key);
    });
    root.querySelector(".au-schools").addEventListener("click", (e) => {
      const c = e.target.closest("[data-s]"); if (!c) return;
      this.state[key].school = c.dataset.s;
      root.querySelectorAll(".au-schools .chip").forEach(x => x.classList.toggle("on", x === c));
      this.renderList(key);
    });
    root.querySelector(".au-list").addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b) this.openCard(key, b.dataset.a); });
    root.querySelector(".au-card").addEventListener("click", (e) => this.cardAction(key, e));
    root.querySelector(".au-cmp").addEventListener("click", () => this.compare(key));
    root.querySelector(".au-b").selectedIndex = Math.min(1, S.list.length - 1);
    root.querySelector(".au-send").addEventListener("click", () => this.send(key));
    root.querySelector(".au-q").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.send(key); } });
    root.querySelector(".au-reset").addEventListener("click", () => { this.state[key].chat = []; this.renderChat(key); });
    root.querySelector(".au-chat-who").addEventListener("change", () => { this.state[key].chat = []; this.renderChat(key); });
    root.querySelector(".au-starters").addEventListener("click", (e) => { const c = e.target.closest("[data-q]"); if (c) { root.querySelector(".au-q").value = c.dataset.q; this.send(key); } });
    root.querySelector(".chat").addEventListener("click", (e) => { const b = e.target.closest("[data-say]"); if (b) tts.say(this.state[key].chat[+b.dataset.say].a, null, "it"); });
    let rec = null;
    root.querySelector(".au-mic").addEventListener("click", () => {
      rec ||= makeRecorder(root.querySelector(".au-mic"), root.querySelector(".au-mic-st"), (t) => { const q = root.querySelector(".au-q"); q.value = (q.value.trim() + " " + t).trim(); }, "");
      rec.toggle();
    });
    root.querySelector(".au-view-switch").addEventListener("click", (e) => {
      const c = e.target.closest("[data-v]"); if (!c) return;
      this.state[key].view = c.dataset.v;
      root.querySelectorAll(".au-view-switch .chip").forEach(x => x.classList.toggle("on", x === c));
      if (c.dataset.v === "line" && !this.state[key].group && S.lineDefault) {
        this.state[key].group = S.lineDefault;
        root.querySelectorAll(".au-groups .chip").forEach(x => x.classList.toggle("on", x.dataset.g === S.lineDefault));
      }
      this.renderList(key);
    });
    root.querySelector(".au-correnti").addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]"); if (a) return this.openCard(key, a.dataset.a);
      const c = e.target.closest("[data-corr]"); if (c) return this.explainCorrente(key, +c.dataset.corr);
    });
    root.querySelector(".au-corr-out").addEventListener("click", (e) => this.resultAction(e, root.querySelector(".au-corr-out")));
    root.querySelector(".au-gsearch").addEventListener("input", () => this.renderGlossary(key));
    root.querySelector(".au-glossary").addEventListener("click", (e) => { const a = e.target.closest("[data-a]"); if (a) this.openCard(key, a.dataset.a); });
    root.querySelector(".au-quiz").addEventListener("click", (e) => this.quizClick(key, e));
    this.renderCorrenti(key);
    root.querySelector(".au-explain").addEventListener("click", () => this.explain(key));
    root.querySelector(".au-concept").addEventListener("keydown", (e) => { if (e.key === "Enter") this.explain(key); });
    root.querySelector(".au-concept-out").addEventListener("click", (e) => this.resultAction(e, root.querySelector(".au-concept-out")));
    root.querySelector(".au-cmp-out").addEventListener("click", (e) => this.resultAction(e, root.querySelector(".au-cmp-out")));
    this.renderChat(key);
  },

  pane(key, name) {
    const root = $(`#view-${key}`);
    if (name === "glossario") this.renderGlossary(key);
    root.querySelectorAll(".seg [data-pane]").forEach(b => b.classList.toggle("on", b.dataset.pane === name || (name === "scheda" && b.dataset.pane === "autori")));
    root.querySelectorAll(".au-pane").forEach(p => p.classList.toggle("hidden", p.dataset.p !== name));
  },

  /** elenco in ordine di tempo, diviso per periodo o disciplina */
  /** Con un'area numerosa (es. Psicologia) compare un secondo filtro: la scuola di pensiero. */
  renderSchools(key) {
    const S = SUBJECTS[key], st = this.state[key];
    const box = $(`#view-${key} .au-schools`);
    const inArea = new Set(S.list.filter(a => a[4] === st.group).map(a => a[0]));
    // ogni scuola compare nell'area del suo primo autore (alcune scuole citano anche autori di altre aree)
    const schools = st.group && inArea.size > 15 ? S.correnti.map((c, i) => [i, c[4] || c[0], inArea.has(c[3][0])]).filter(x => x[2]) : [];
    box.classList.toggle("hidden", !schools.length);
    box.innerHTML = schools.length ? `<span class="au-schools-l">Scuola:</span>` + [["", "Tutte"], ...schools.map(([i, n]) => [String(i), n])]
      .map(([v, l]) => `<button class="chip small${v === (st.school || "") ? " on" : ""}" data-s="${v}">${escapeHtml(l)}</button>`).join("") : "";
  },

  renderList(key) {
    const S = SUBJECTS[key], st = this.state[key];
    const inSchool = st.school !== "" && st.school != null && S.correnti[+st.school] ? new Set(S.correnti[+st.school][3]) : null;
    const box = $(`#view-${key} .au-list`);
    if (st.view === "line") return this.renderLine(key, box);
    const cached = (id) => !!store.get("autore:" + id, null);
    const html = S.groups.filter(g => !st.group || g.id === st.group).map(g => {
      const items = S.list.filter(a => a[4] === g.id && (!inSchool || inSchool.has(a[0])) && (!st.q || a[1].toLowerCase().includes(st.q) || a[5].toLowerCase().includes(st.q))).sort((a, b) => a[2] - b[2]);
      if (!items.length) return "";
      return `<section class="au-group g-${g.c}">
        <header><h3>${escapeHtml(g.name)}</h3><small>${g.from != null ? `${yearTxt(g.from)} – ${g.to > 1990 ? "oggi" : yearTxt(g.to)} · ` : ""}${escapeHtml(g.desc)}${g.school ? ` · <b>${g.school}</b>` : ""}</small></header>
        <ol class="au-items">${items.map(a => `<li><button data-a="${a[0]}">
          <span class="au-years">${lifeTxt(a[2], a[3])}</span>
          <span class="au-name">${escapeHtml(a[1])}${cached(a[0]) ? ` <span class="au-saved" title="Scheda già pronta">${icon("check")}</span>` : ""}</span>
          <span class="au-tag">${escapeHtml(a[5])}</span></button></li>`).join("")}</ol>
      </section>`;
    }).join("");
    box.innerHTML = html || `<p class="hint">Nessun autore trovato. Prova con un altro nome, oppure chiedi una spiegazione nella sezione Concetti.</p>`;
  },

  /** Linea del tempo visiva: la vita di ogni autore è una barra; si vede chi era contemporaneo di chi. */
  renderLine(key, box) {
    const S = SUBJECTS[key], st = this.state[key];
    const inSchool = st.school !== "" && st.school != null && S.correnti[+st.school] ? new Set(S.correnti[+st.school][3]) : null;
    const items = S.list.filter(a => (!st.group || a[4] === st.group) && (!inSchool || inSchool.has(a[0])) && (!st.q || a[1].toLowerCase().includes(st.q))).sort((a, b) => a[2] - b[2]);
    if (!items.length) { box.innerHTML = `<p class="hint">Nessun autore trovato.</p>`; return; }
    const now = new Date().getFullYear();
    const from = Math.min(...items.map(a => a[2])), to = Math.max(...items.map(a => a[3] ?? now));
    const span = Math.max(to - from, 20);
    const pad = span * 0.03, lo = from - pad, hi = to + pad;
    const pct = (y) => ((y - lo) / (hi - lo) * 100).toFixed(2) + "%";
    // tacche ogni 10, 25, 50, 100… anni
    const steps = [10, 25, 50, 100, 200, 250, 500];
    const step = steps.find(x => span / x <= 6) || 500;
    const ticks = [];
    for (let y = Math.ceil(lo / step) * step; y <= hi; y += step) ticks.push(y);
    const color = (a) => (S.groups.find(g => g.id === a[4]) || {}).c || "sky";
    box.innerHTML = `<div class="au-line">
      <div class="al-axis">${ticks.map(y => `<span style="left:${pct(y)}">${y < 0 ? -y + " a.C." : y === 0 ? "0" : lo < 0 ? y + " d.C." : y}</span>`).join("")}</div>
      ${items.map(a => `<button class="al-row" data-a="${a[0]}">
        <span class="al-name">${escapeHtml(a[1])}</span>
        <span class="al-track">${ticks.map(y => `<i style="left:${pct(y)}"></i>`).join("")}
          <span class="al-bar g-${color(a)}" style="left:${pct(a[2])};width:calc(${pct(a[3] ?? now)} - ${pct(a[2])})"></span></span>
      </button>`).join("")}
    </div>
    <p class="hint">${st.group ? "" : "Suggerimento: scegli un periodo per vedere meglio le barre. "}Le barre che si sovrappongono sono autori vissuti nello stesso tempo.</p>`;
  },

  renderCorrenti(key) {
    const S = SUBJECTS[key];
    $(`#view-${key} .au-correnti`).innerHTML = S.correnti.map(([nome, per, idea, ids], i) => `
      <section class="au-corr">
        <header><h3>${escapeHtml(nome)}</h3><small>${escapeHtml(per)}</small></header>
        <p>${escapeHtml(idea)}</p>
        <div class="chips">${ids.map(id => { const a = this.find(key, id); return a ? `<button class="chip" data-a="${id}">${escapeHtml(a.name)}</button>` : ""; }).join("")}</div>
        <button class="btn small ghost" data-corr="${i}">${icon("bulb")}${S.correntiLabel ? "Spiegami questo genere" : "Spiegami questa corrente"}</button>
      </section>`).join("");
  },

  async explainCorrente(key, i) {
    const [nome, per, , ids] = SUBJECTS[key].correnti[i];
    const autori = ids.map(id => this.find(key, id)?.name).filter(Boolean).join(", ");
    const out = $(`#view-${key} .au-corr-out`);
    try {
      busy(true, "Preparo la spiegazione…");
      const md = await ask({ prompt: AUTORE_PROMPTS.concetto(`${SUBJECTS[key].correntiLabel ? "il genere letterario" : "la corrente"} «${nome}» (${per}; autori: ${autori})`, SUBJECTS[key].materia), system: SYSTEM_TUTOR, temperature: 0.3 });
      out.innerHTML = `<h2>${escapeHtml(nome)}</h2><div class="result">${mdToHtml(md)}</div>
        <div class="btn-row"><button class="btn" data-r="read">${icon("volume")}Ascolta</button><button class="btn" data-r="map">${icon("map")}Mappa</button><button class="btn" data-r="cards">${icon("cards")}Flashcard</button><button class="btn" data-r="print">${icon("printer")}Stampa</button></div>`;
      out.dataset.md = md; out.dataset.title = nome;
      out.classList.remove("hidden");
      out.scrollIntoView({ behavior: "smooth" });
    } catch (e) { toast(e.message || "Non sono riuscito a spiegarla. Riprova.", 6000); }
    finally { busy(false); }
  },

  /** Glossario: le parole chiave di tutte le schede già aperte di questa materia */
  renderGlossary(key) {
    const S = SUBJECTS[key];
    const q = $(`#view-${key} .au-gsearch`).value.trim().toLowerCase();
    const words = [];
    S.list.forEach(a => {
      const d = store.get("autore:" + a[0], null);
      (d?.parole || []).forEach(w => w?.parola && words.push({ w: w.parola, m: w.significato || "", a: a[0], n: a[1] }));
    });
    const shown = words.filter(x => !q || x.w.toLowerCase().includes(q) || x.m.toLowerCase().includes(q)).sort((x, y) => x.w.localeCompare(y.w, "it"));
    $(`#view-${key} .au-glossary`).innerHTML = !words.length
      ? `<p class="hint">Il glossario è ancora vuoto: apri la scheda di un autore e le sue parole chiave compariranno qui.</p>`
      : shown.length ? `<dl class="au-words au-gl">${shown.map(x => `<dt>${escapeHtml(x.w)}</dt><dd>${escapeHtml(x.m)} <button class="linklike" data-a="${x.a}">${escapeHtml(x.n)}</button></dd>`).join("")}</dl>`
      : `<p class="hint">Nessuna parola trovata.</p>`;
  },

  /* ---------- quiz a scelta multipla sull'autore ---------- */
  async startQuiz(key, fresh = false) {
    const a = this.find(key, this.state[key].current);
    let qz = fresh ? null : store.get("quiz:" + a.id, null);
    if (!qz) {
      try {
        busy(true, "Preparo il quiz…");
        qz = parseJSON(await ask({ prompt: AUTORE_PROMPTS.quiz(a.name, this.cardText(key)), json: true, temperature: 0.4, quality: true }));
        qz.domande = (qz.domande || []).filter(d => d.domanda && Array.isArray(d.opzioni) && d.opzioni.length >= 2 && d.giusta >= 0 && d.giusta < d.opzioni.length);
        if (!qz.domande.length) throw new Error("Non sono riuscito a preparare il quiz. Riprova.");
        store.set("quiz:" + a.id, qz);
      } catch (e) { busy(false); return toast(e.message || "Non sono riuscito a preparare il quiz. Riprova.", 6000); }
      busy(false);
    }
    this.state[key].quiz = { qz, i: 0, ok: 0, answered: false };
    this.renderQuiz(key);
    const box = $(`#view-${key} .au-quiz`);
    box.classList.remove("hidden");
    box.scrollIntoView({ behavior: "smooth" });
  },
  renderQuiz(key) {
    const st = this.state[key].quiz, box = $(`#view-${key} .au-quiz`);
    const a = this.find(key, this.state[key].current);
    const n = st.qz.domande.length;
    if (st.i >= n) {
      const msg = st.ok === n ? "Perfetto!" : st.ok >= n * 0.6 ? "Bene!" : "Ripassa la scheda e riprova.";
      box.innerHTML = `<h2>Quiz su ${escapeHtml(a.name)}</h2><div class="qz-end"><b>${st.ok} su ${n}</b><p>${msg}</p></div>
        <div class="btn-row"><button class="btn primary" data-qz="again">${icon("repeat")}Rifai</button><button class="btn" data-qz="new">${icon("sparkles")}Domande nuove</button></div>`;
      return;
    }
    const d = st.qz.domande[st.i];
    box.innerHTML = `<div class="qz-top"><h2>Quiz su ${escapeHtml(a.name)}</h2><span>${st.i + 1} di ${n}</span></div>
      <div class="progress"><div style="width:${st.i / n * 100}%"></div></div>
      <div class="qz-q">${escapeHtml(d.domanda)} <button class="icon-btn" data-qz="say" aria-label="Ascolta">${icon("volume")}</button></div>
      <div class="qz-opts">${d.opzioni.map((o, k) => `<button class="qz-opt" data-opt="${k}"><span>${"ABCD"[k]}</span>${escapeHtml(o)}</button>`).join("")}</div>
      <div class="qz-exp hidden"></div>
      <div class="btn-row hidden qz-next"><button class="btn primary" data-qz="next">Avanti</button></div>`;
  },
  quizClick(key, e) {
    const st = this.state[key].quiz;
    const o = e.target.closest("[data-opt]"), c = e.target.closest("[data-qz]");
    const box = $(`#view-${key} .au-quiz`);
    if (o && !st.answered) {
      const d = st.qz.domande[st.i], k = +o.dataset.opt;
      st.answered = true;
      if (k === d.giusta) st.ok++;
      box.querySelectorAll(".qz-opt").forEach((b, j) => { b.disabled = true; if (j === d.giusta) b.classList.add("ok"); else if (j === k) b.classList.add("no"); });
      const ex = box.querySelector(".qz-exp");
      ex.innerHTML = `<b>${k === d.giusta ? "Giusto!" : "Non è questa."}</b> ${escapeHtml(d.spiegazione || "")}`;
      ex.classList.remove("hidden"); box.querySelector(".qz-next").classList.remove("hidden");
      return;
    }
    if (!c) return;
    if (c.dataset.qz === "say") { const d = st.qz.domande[st.i]; return tts.say(d.domanda + ". " + d.opzioni.map((x, j) => "ABCD"[j] + ": " + x).join(". "), null, "it"); }
    if (c.dataset.qz === "next") { st.i++; st.answered = false; return this.renderQuiz(key); }
    if (c.dataset.qz === "again") return this.startQuiz(key);
    if (c.dataset.qz === "new") return this.startQuiz(key, true);
  },

  /* ---------- scheda autore ---------- */
  /** La voce di Wikipedia dell'autore (se la trovo con sicurezza), da usare come base della scheda. */
  async wikiSource(key, a) {
    try {
      const role = SUBJECTS[key].role || key === "filo" ? (SUBJECTS[key].role || "filosofo") : ({ pedagogia: "pedagogista", psicologia: "psicologo", sociologia: "sociologo", antropologia: "antropologo" }[a.group] || "");
      const surname = a.name.split(/\s+/).pop().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const norm = (t) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const hits = await web.wikiSearch(`${a.name} ${role}`);
      const hit = hits.find(h => norm(h.title).includes(surname) && !/disambigua|\(film|\(album/i.test(h.title));
      if (!hit) return null;
      const w = await web.wikiText("it", hit.title);
      if (w.text.length < 800) return null;
      return { title: w.title, text: w.text.slice(0, 12000) };
    } catch { return null; }
  },

  async openCard(key, id, regenerate = false) {
    const a = this.find(key, id);
    if (!a) return;
    this.state[key].current = id;
    const cached = store.get("autore:" + id, null);
    // le schede fatte prima del controllo su Wikipedia vengono rifatte una volta (se qualcosa va storto, tengo la vecchia)
    let data = regenerate || (cached && !cached.v2) ? null : cached;
    if (!data) {
      try {
        busy(true, `Cerco ${a.name} su Wikipedia…`);
        const fonte = await this.wikiSource(key, a);
        busy(true, `Preparo la scheda di ${a.name}…`);
        data = parseJSON(await ask({ prompt: AUTORE_PROMPTS.scheda(a.name, this.materiaOf(key, a), lifeTxt(a.from, a.to), fonte, SUBJECTS[key].extra), json: true, temperature: 0.2, quality: true }));
        data.v2 = true;
        if (cached) store.set("quiz:" + id, null);
        if (fonte) data.fonte = { title: fonte.title, url: `https://it.wikipedia.org/wiki/${encodeURIComponent(fonte.title.replace(/ /g, "_"))}` };
        store.set("autore:" + id, data);
        this.renderList(key);
      } catch (e) {
        busy(false);
        if (cached && !regenerate) data = cached;
        else return toast(e.message || "Non sono riuscito a preparare la scheda. Riprova.", 6000);
      }
      busy(false);
    }
    const g = this.groupOf(key, a.group);
    const L = (arr) => Array.isArray(arr) ? arr : [];
    const card = $(`#view-${key} .au-card`);
    card.innerHTML = `
      <button class="btn small ghost au-back">${icon("back")}Tutti gli autori</button>
      <div class="au-head g-${g.c}">
        <div><h1>${escapeHtml(a.name)}</h1><p class="au-meta">${lifeTxt(a.from, a.to)} · ${escapeHtml(g.short || g.name)}</p></div>
      </div>
      ${data.in_breve ? `<p class="au-brief">${escapeHtml(data.in_breve)}</p>` : ""}
      <div class="au-actions">
        <button class="tool" data-act="read">${icon("volume")}<span>Ascolta</span></button>
        <button class="tool" data-act="mappa">${icon("map")}<span>Mappa</span></button>
        <button class="tool" data-act="flashcard">${icon("cards")}<span>Flashcard</span></button>
        <button class="tool" data-act="quiz">${icon("check")}<span>Quiz</span></button>
        <button class="tool" data-act="interroga">${icon("chat")}<span>Interrogami</span></button>
        <button class="tool" data-act="chiedi">${icon("help")}<span>Fagli domande</span></button>
        <button class="tool" data-act="save">${icon("bookmark")}<span>Salva</span></button>
        <button class="tool" data-act="print">${icon("printer")}<span>Stampa</span></button>
      </div>
      <div class="au-body">
        ${data.contesto ? `<h3>Il contesto</h3><p>${escapeHtml(data.contesto)}</p>` : ""}
        ${L(data.vita).length ? `<h3>La vita in breve</h3><ul>${L(data.vita).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>` : ""}
        ${L(data.pensiero).length ? `<h3>${SUBJECTS[key].pensieroLabel || "Il pensiero"}</h3><ol class="au-ideas">${L(data.pensiero).map(p => `<li><b>${escapeHtml(p.titolo || "")}</b><p>${escapeHtml(p.spiegazione || "")}</p></li>`).join("")}</ol>` : ""}
        ${data.esempio ? `<div class="au-example"><b>Un esempio per capire</b><p>${escapeHtml(data.esempio)}</p></div>` : ""}
        ${L(data.parole).length ? `<h3>Parole chiave</h3><dl class="au-words">${L(data.parole).map(w => `<dt>${escapeHtml(w.parola || "")}</dt><dd>${escapeHtml(w.significato || "")}</dd>`).join("")}</dl>` : ""}
        ${L(data.opere).length ? `<h3>Le opere</h3><ul class="au-works">${L(data.opere).map(o => `<li><b>${escapeHtml(o.titolo || "")}</b>${o.anno ? ` <span class="au-years">${escapeHtml(String(o.anno))}</span>` : ""}<br>${escapeHtml(o.di_cosa_parla || "")}</li>`).join("")}</ul>` : ""}
        ${L(data.collegamenti).length ? `<h3>Collegamenti</h3><ul class="au-links">${L(data.collegamenti).map(c => `<li><b>${escapeHtml(c.autore || "")}</b>: ${escapeHtml(c.rapporto || "")}</li>`).join("")}</ul>` : ""}
        ${data.frase?.testo ? `<blockquote class="au-quote">${data.frase.latino ? `<p class="au-latin" lang="la">${escapeHtml(data.frase.latino)}</p>` : ""}<p>«${escapeHtml(data.frase.testo)}»</p>${data.frase.spiegazione ? `<small>${escapeHtml(data.frase.spiegazione)}</small>` : ""}</blockquote>` : ""}
        ${data.attualita ? `<h3>Perché è ancora attuale</h3><p>${escapeHtml(data.attualita)}</p>` : ""}
        ${L(data.domande).length ? `<h3>Domande da interrogazione</h3><ol>${L(data.domande).map(q => `<li>${escapeHtml(q)}</li>`).join("")}</ol>` : ""}
        <p class="hint au-note">${data.fonte ? `Scheda preparata dall'IA partendo dalla voce di Wikipedia <a href="${escapeHtml(data.fonte.url)}" target="_blank" rel="noopener">«${escapeHtml(data.fonte.title)}»</a>.` : "Scheda preparata dall'IA."} Confrontala con il libro e con gli appunti. <button class="linklike" data-act="regen">Rifalla</button></p>
      </div>`;
    $(`#view-${key} .au-quiz`).classList.add("hidden");
    this.pane(key, "scheda");
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  },

  /** la scheda come testo semplice, per mappe, flashcard, interrogazione e ascolto */
  cardText(key) {
    const a = this.find(key, this.state[key].current);
    const d = store.get("autore:" + a.id, {});
    const L = (x) => Array.isArray(x) ? x : [];
    return [`# ${a.name} (${lifeTxt(a.from, a.to)})`, d.in_breve, d.contesto && "## Contesto\n" + d.contesto,
      L(d.vita).length && "## Vita\n" + L(d.vita).map(x => "- " + x).join("\n"),
      L(d.pensiero).length && "## Pensiero\n" + L(d.pensiero).map(p => `- **${p.titolo}**: ${p.spiegazione}`).join("\n"),
      L(d.parole).length && "## Parole chiave\n" + L(d.parole).map(w => `- **${w.parola}**: ${w.significato}`).join("\n"),
      L(d.opere).length && "## Opere\n" + L(d.opere).map(o => `- ${o.titolo} (${o.anno || ""}): ${o.di_cosa_parla || ""}`).join("\n"),
      L(d.collegamenti).length && "## Collegamenti\n" + L(d.collegamenti).map(c => `- ${c.autore}: ${c.rapporto}`).join("\n"),
      d.attualita && "## Attualità\n" + d.attualita].filter(Boolean).join("\n\n");
  },

  async cardAction(key, e) {
    if (e.target.closest(".au-back")) { this.pane(key, "autori"); return; }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const a = this.find(key, this.state[key].current);
    const text = this.cardText(key);
    const act = b.dataset.act;
    if (act === "read") return tts.say(text.replace(/^#+\s*/gm, ""), null, "it");
    if (act === "regen") { store.set("quiz:" + a.id, null); return this.openCard(key, a.id, true); }
    if (act === "quiz") return this.startQuiz(key);
    if (act === "mappa" || act === "flashcard" || act === "interroga") {
      reader.subject = SUBJECTS[key].title;
      if (act === "interroga") { showView("ripassa"); ripassa.tab("interroga"); return quiz.setSource(text, a.name); }
      return runAction(act, text);
    }
    if (act === "chiedi") {
      $(`#view-${key} .au-chat-who`).value = a.id;
      this.state[key].chat = []; this.renderChat(key);
      return this.pane(key, "chiedi");
    }
    if (act === "save") {
      if (notebookPut({ id: "au-" + a.id, type: "testo", title: a.name, subject: SUBJECTS[key].title, date: todayLabel(), data: text })) toast("Scheda salvata nel quaderno");
      return;
    }
    if (act === "print") {
      const box = $(`#view-${key} .au-card`).cloneNode(true);
      box.querySelectorAll("button, .au-actions, .au-note").forEach(x => x.remove());
      printer.run(`<div class="print-text au-print">${box.innerHTML}</div>`, { title: `${SUBJECTS[key].title}: ${a.name}` });
    }
  },

  /* ---------- confronto ---------- */
  async compare(key) {
    const root = $(`#view-${key}`);
    const A = this.find(key, root.querySelector(".au-a").value), B = this.find(key, root.querySelector(".au-b").value);
    if (A.id === B.id) return toast("Scegli due autori diversi.");
    try {
      busy(true, `Confronto ${A.name} e ${B.name}…`);
      const d = parseJSON(await ask({ prompt: AUTORE_PROMPTS.confronta(A.name, B.name, SUBJECTS[key].materia), json: true, temperature: 0.2, quality: true }));
      const r = renderCompare(d);
      const out = root.querySelector(".au-cmp-out");
      out.innerHTML = `<h2>${escapeHtml(r.title)}</h2><div class="result">${r.html}</div>
        ${d.in_comune ? `<p class="au-summ"><b>In comune:</b> ${escapeHtml(d.in_comune)}</p>` : ""}
        ${d.differenza ? `<p class="au-summ"><b>La differenza più importante:</b> ${escapeHtml(d.differenza)}</p>` : ""}
        <div class="btn-row"><button class="btn" data-r="read">${icon("volume")}Ascolta</button><button class="btn" data-r="cards">${icon("cards")}Flashcard</button><button class="btn" data-r="print">${icon("printer")}Stampa</button></div>`;
      out.dataset.md = r.md + (d.in_comune ? "\n\nIn comune: " + d.in_comune : "") + (d.differenza ? "\n\nDifferenza: " + d.differenza : "");
      out.dataset.title = r.title;
      out.classList.remove("hidden");
      out.scrollIntoView({ behavior: "smooth" });
    } catch (e) { toast(e.message || "Non sono riuscito a fare il confronto. Riprova.", 6000); }
    finally { busy(false); }
  },

  /* pulsanti sotto confronto e concetto */
  resultAction(e, out) {
    const b = e.target.closest("[data-r]"); if (!b) return;
    const md = out.dataset.md || "";
    if (b.dataset.r === "read") return tts.say(md, null, "it");
    if (b.dataset.r === "cards") return runAction("flashcard", md);
    if (b.dataset.r === "map") return runAction("mappa", md);
    if (b.dataset.r === "print") {
      const box = out.cloneNode(true);
      box.querySelectorAll(".btn-row").forEach(x => x.remove());
      printer.run(`<div class="print-text">${box.innerHTML}</div>`, { title: out.dataset.title || "Zaino" });
    }
  },

  /* ---------- domande all'autore ---------- */
  renderChat(key) {
    const root = $(`#view-${key}`);
    const a = this.find(key, root.querySelector(".au-chat-who").value);
    const chat = this.state[key].chat;
    const box = root.querySelector(".chat");
    box.innerHTML = chat.length ? chat.map((m, i) => `
      <div class="msg me">${escapeHtml(m.q)}</div>
      <div class="msg them"><b>${escapeHtml(a.name)}</b><p>${escapeHtml(m.a)}</p><button class="icon-btn" data-say="${i}" aria-label="Ascolta">${icon("volume")}</button></div>`).join("")
      : `<p class="hint chat-empty">Inizia con una delle domande qui sotto, oppure scrivine una tua.</p>`;
    const starters = chat.length ? ["Puoi farmi un esempio?", "Con chi non eri d'accordo?", "Come lo spiegheresti a un bambino?"]
      : ["Qual è la tua idea più importante?", "Che problema volevi risolvere?", "Cosa diresti a una ragazza di oggi?"];
    root.querySelector(".au-starters").innerHTML = starters.map(q => `<button class="chip" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join("");
    box.scrollTop = box.scrollHeight;
  },
  async send(key) {
    const root = $(`#view-${key}`);
    const q = root.querySelector(".au-q").value.trim();
    if (!q) return toast("Scrivi o detta prima la domanda.");
    const a = this.find(key, root.querySelector(".au-chat-who").value);
    const chat = this.state[key].chat;
    const storia = chat.slice(-5).map(m => `Studentessa: ${m.q}\n${a.name}: ${m.a}`).join("\n");
    try {
      busy(true, `${a.name} ci pensa…`);
      const ans = (await ask({ prompt: AUTORE_PROMPTS.chat(a.name, lifeTxt(a.from, a.to), storia, q), temperature: 0.6 })).trim();
      chat.push({ q, a: ans });
      root.querySelector(".au-q").value = "";
      this.renderChat(key);
      root.querySelector(".chat .msg.them:last-of-type")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (e) { toast(e.message || "Non sono riuscito a rispondere. Riprova.", 6000); }
    finally { busy(false); }
  },

  /* ---------- concetti ---------- */
  async explain(key) {
    const root = $(`#view-${key}`);
    const c = root.querySelector(".au-concept").value.trim();
    if (!c) return toast("Scrivi prima il concetto.");
    try {
      busy(true, "Preparo la spiegazione…");
      const md = await ask({ prompt: AUTORE_PROMPTS.concetto(c, SUBJECTS[key].materia), system: SYSTEM_TUTOR, temperature: 0.3 });
      const out = root.querySelector(".au-concept-out");
      out.innerHTML = `<h2>${escapeHtml(c[0].toUpperCase() + c.slice(1))}</h2><div class="result">${mdToHtml(md)}</div>
        <div class="btn-row"><button class="btn" data-r="read">${icon("volume")}Ascolta</button><button class="btn" data-r="map">${icon("map")}Mappa</button><button class="btn" data-r="cards">${icon("cards")}Flashcard</button><button class="btn" data-r="print">${icon("printer")}Stampa</button></div>`;
      out.dataset.md = md; out.dataset.title = c;
      out.classList.remove("hidden");
      out.scrollIntoView({ behavior: "smooth" });
    } catch (e) { toast(e.message || "Non sono riuscito a spiegarlo. Riprova.", 6000); }
    finally { busy(false); }
  }
};
