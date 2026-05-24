const express = require('express');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 6789;
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
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
    let db = new sqlite3.Database('./cumparaturi.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.render('index', { produse: [] }); 
        }
    });

    // Extragem toate produsele din baza de date
    db.all("SELECT * FROM produse", [], (err, rows) => {
        if (err) {
            console.error("Eroare la citirea produselor:", err.message);
            res.render('index', { produse: [] });
        } else {
            // Trimitem rândurile (produsele) către index.ejs
            res.render('index', { produse: rows });
        }
        db.close();
    });
});

app.get('/autentificare', (req, res) => {
    let mesajEroare = req.cookies.mesajEroare;
    res.render('autentificare', { eroare: mesajEroare }); // 
});

app.get('/delogare', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.post('/verificare-autentificare', 
    body('utilizator').trim().escape(), 
    body('parola').trim(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            res.cookie('mesajEroare', 'Datele introduse conțin caractere invalide!');
            return res.redirect('/autentificare');
        }

        const { utilizator, parola } = req.body;

        try {
            const rawData = fs.readFileSync('utilizatori.json');
            const utilizatori = JSON.parse(rawData);

            
            const userGasit = utilizatori.find(u => u.utilizator === utilizator);

            
            if (userGasit && await bcrypt.compare(parola, userGasit.parola)) {
                const { parola: passwordProp, ...dateSesiune } = userGasit; 
                req.session.utilizator = dateSesiune; 
                
                
                res.clearCookie('mesajEroare');
                res.redirect('/');
            } else {
                res.cookie('mesajEroare', 'Utilizator sau parolă greșite!');
                res.redirect('/autentificare');
            }
        } catch (error) {
            console.error("Eroare la autentificare:", error);
            res.cookie('mesajEroare', 'A apărut o eroare pe server.');
            res.redirect('/autentificare');
        }
    }
);


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

app.post('/adaugare-cos', (req, res) => {
    
    if (!req.session.utilizator) {
        return res.redirect('/autentificare');
    }

    const idProdus = req.body.id;

    
    if (!req.session.cos) {
        req.session.cos = [];
    }

    req.session.cos.push(idProdus);

    console.log("Coșul curent conține ID-urile:", req.session.cos); 

    res.redirect('/');
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

app.get('/vizualizare-cos', (req, res) => {
    if (!req.session.utilizator) {
        return res.redirect('/autentificare');
    }

    const cos = req.session.cos || [];

    if (cos.length === 0) {
        return res.render('vizualizare-cos', { produseCos: [] });
    }

    let db = new sqlite3.Database('./cumparaturi.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.render('vizualizare-cos', { produseCos: [] });
        }
    });

    const placeholders = cos.map(() => '?').join(',');
    const query = `SELECT * FROM produse WHERE id IN (${placeholders})`;

    db.all(query, cos, (err, rows) => {
        if (err) {
            console.error("Eroare la extragerea din coș:", err.message);
            res.render('vizualizare-cos', { produseCos: [] });
        } else {

            const produseDeAfisat = cos.map(idCos => {
                return rows.find(randBazaDate => randBazaDate.id.toString() === idCos.toString());
            }).filter(p => p !== undefined); // filtrăm eventualele produse șterse

            res.render('vizualizare-cos', { produseCos: produseDeAfisat });
        }
        db.close();
    });
});


app.listen(port, () => console.log(`Serverul rulează la adresa http://localhost:${port}/`));

