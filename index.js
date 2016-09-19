
var TUCAN = "https://www.tucan.tu-darmstadt.de";

var jsonfile = require('jsonfile');
var Nightmare = require('nightmare');
var nodemailer = require('nodemailer');

var nightmare;
var config = {};

var notenFile = 'noten.json';
var configFile = 'config.json';


var getNoten = function (user, pw) {
    return new Promise(function (resolve, reject) {
        nightmare = Nightmare({ show: false })

        nightmare
            .goto(TUCAN)
            .wait('#cn_loginForm')
            .insert('#field_user', user)
            .insert('#field_pass', pw)
            .click('#logIn_btn')
            .wait(1000)
            .wait('li[title="Prüfungen"] a')
            .click('li[title="Prüfungen"] a')
            .wait('li[title="Prüfungsergebnisse"] a')
            .click('li[title="Prüfungsergebnisse"] a')
            .wait('#semesterchange')
            .evaluate(function () {
                var rows = document.querySelectorAll('tr[class="tbdata"]');
                return Array.prototype.map.call(rows, function (tr) {
                    return {
                        name: tr.children[0].innerText.trim(),
                        note: tr.children[2].innerText.trim()
                    };
                });
            })
            .then(function (result) {
                resolve(result);
            })
            .catch(function (error) {
                console.error('Search failed:', error);
                reject(error);
            });
    });
};

var sendMail = function (mailAddress, mailUser, mailPW, noten) {
    return new Promise(function (resolve, reject) {
        // create reusable transporter object using the default SMTP transport
        var transporter = nodemailer.createTransport("SMTP", {
            host: "smtp.gmail.com", // hostname
            secureConnection: true, // use SSL
            port: 465, // port for secure SMTP
            auth: {
                user: mailAddress,
                pass: mailPW
            }
        });

        var html = '<h1>Hier deine aktuellen Noten:</h1>';
        noten.forEach(function (element) {
            html = html + "<p>" + element.name + "<br /><b>Note: " + element.note + "</b></p><br />";
        });

        // setup e-mail data with unicode symbols
        var mailOptions = {
            from: mailAddress, // sender address
            to: mailAddress, // list of receivers
            subject: 'Neue Note auf TUCaN!', // Subject line
            text: html.replace(/<\/?[^>]+(>|$)/g, ""), // plaintext body
            html: html // html body
        };
        
        // send mail with defined transport object
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                reject(error);
            }
            //console.log('Message sent: ' + info.response);
            resolve();
        });
    });
};

try {
    config = jsonfile.readFileSync(configFile, 'utf8');
} catch (error) {
    console.log("Keine Config! Ist die Datei config.json vorhanden?");
    console.log(error);
    process.exit(1);
}

getNoten(config.tuid, config.password).then(function (noten) {
    // Beende nightmare
    nightmare.end();
    
    // Alte Noten holen  
    var alteNoten = [];
    try {
        alteNoten = jsonfile.readFileSync(notenFile, 'utf8');
    } catch (error) {
        console.log("Keine Noten gespeichert");
        console.log(error);
    }

    
    
    // Neue Noten speichern
    jsonfile.writeFileSync(notenFile, noten, { spaces: 2 }); //
    
    // Anzahl der Noten vergleichen
    if (alteNoten.length !== noten.length) {
        console.log("Vorher: " + alteNoten.length);
        console.log("Nachher: " + noten.length);

        console.log("Neue Noten!");
        sendMail(config.gmailaddress, config.gmailuser, config.gmailpassword, noten).then(
            function () {
                console.log("Ende");
                process.exit();
            }, function (error) {
                console.log("Error!");
                console.log(error);
            });
    } else {
        console.log("Keine neuen Noten... :-(");
        process.exit();
    }

});