const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 6789;
// directorul 'views' va conține fișierele .ejs (html + js executat la server)
app.set('view engine', 'ejs');
// suport pentru layout-uri - implicit fișierul care reprezintă template-ul site-ului este views/layout.ejs
app.use(expressLayouts);
// directorul 'public' va conține toate resursele accesibile direct de către client (e.g., fișiere css, javascript, imagini)
app.use(express.static('public'));

app.use(cookieParser());

// corpul mesajului poate fi interpretat ca json; datele de la formular se găsesc în format json în req.body
app.use(bodyParser.json());
// utilizarea unui algoritm de deep parsing care suportă obiecte în obiecte
app.use(bodyParser.urlencoded({ extended: true }));
// la accesarea din browser adresei http://localhost:6789/ se va returna textul 'Hello World'
// proprietățile obiectului Request - req - https://expressjs.com/en/api.html#req
// proprietățile obiectului Response - res - https://expressjs.com/en/api.html#res

app.use(session({
    secret: 'cheie-secreta-cosmetice',
    resave: false,
    saveUninitialized: false
}));

app.use((req, res, next) => {
    res.locals.utilizatorSesiune = req.session.utilizator;
    next();
});

app.get('/', (req, res) => {
    let utilizatorLogat = req.cookies.utilizator;
    res.render('index', { utilizator: utilizatorLogat }); 
});

app.get('/autentificare', (req, res) => {
    let mesajEroare = req.cookies.mesajEroare;
    res.render('autentificare', { eroare: mesajEroare }); // 
});

app.get('/delogare', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.post('/verificare-autentificare', (req, res) => {
    const { utilizator, parola } = req.body;

    const rawData = fs.readFileSync('utilizatori.json');
    const utilizatori = JSON.parse(rawData);

    
    const userGasit = utilizatori.find(u => u.utilizator === utilizator && u.parola === parola);

    if (userGasit) {
        
        const { parola: passwordProp, ...dateSesiune } = userGasit; 
        
        req.session.utilizator = dateSesiune; 
        
        res.redirect('/');
    } else {
        res.cookie('eroare', 'Utilizator sau parolă greșite!');
        res.redirect('/autentificare');
    }
});


app.get('/chestionar', (req, res) => {
    if (!req.session.utilizator) {
        return res.redirect('/autentificare');
    }

    const rawData = fs.readFileSync('intrebari.json');
    const intrebari = JSON.parse(rawData);
    
    res.render('chestionar', { intrebari: intrebari });
});

app.post('/rezultat-chestionar', (req, res) => {
    const raspunsuriUtilizator = req.body;
    const rawData = fs.readFileSync('intrebari.json');
    const intrebari = JSON.parse(rawData);
    
    let scor = 0;

    intrebari.forEach((intrebare, index) => {

        if (raspunsuriUtilizator['q' + index] == intrebare.corect) {
            scor++;
        }
    });

    res.render('rezultat-chestionar', { 
        scor: scor, 
        total: intrebari.length 
    });
});


app.get('/creare-bd', (req, res) => {
    
    let db = new sqlite3.Database('./cumparaturi.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Eroare la conectarea la BD.");
        }
    });

    
    const queryCreare = `
        CREATE TABLE IF NOT EXISTS produse (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nume TEXT NOT NULL,
            pret REAL NOT NULL,
            categorie TEXT
        )
    `;

    db.run(queryCreare, (err) => {
        if (err) {
            console.error("Eroare la crearea tabelei:", err.message);
        } else {
            console.log("Tabela 'produse' a fost creată sau exista deja.");
        }
        
        db.close();
        res.redirect('/');
    });
});

app.get('/inserare-bd', (req, res) => {
    let db = new sqlite3.Database('./cumparaturi.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Eroare la conectarea la BD.");
        }
    });

    const produseCosmetice = [
        ['Fond de ten matifiant', 65.50, 'Machiaj'],
        ['Cremă hidratantă de noapte', 45.00, 'Îngrijire ten'],
        ['Mascara volum intens', 35.99, 'Machiaj'],
        ['Ser cu Vitamina C', 80.00, 'Îngrijire ten']
    ];

    const queryInserare = `INSERT INTO produse (nume, pret, categorie) VALUES (?, ?, ?)`;

    db.serialize(() => {
        const stmt = db.prepare(queryInserare);
        for (let produs of produseCosmetice) {
            stmt.run(produs, (err) => {
                if (err) {
                    console.error("Eroare la inserare:", err.message);
                }
            });
        }
        stmt.finalize();
    });

    db.close((err) => {
        if (err) {
            console.error(err.message);
        } else {
            console.log("Produsele au fost inserate cu succes!");
        }
        res.redirect('/');
    });
});

app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:${port}/`));

