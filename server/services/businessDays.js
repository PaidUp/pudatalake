var moment = require('moment-business-days'),
    bugsnag = require("bugsnag"),
    log = require("./log.service");
    dbService = require("./db.service");


function instance () {
    return new Promise( (resolve, reject) => {
        let dbi = null;
        try {
            if(instance.moment){
                return resolve(instance.moment);
            }
            dbService.getAtlasConnection().then(db => { 
                dbi = db;
                db.collection("holidays").findOne({ locale: "us"}, {}, (err, doc) => {
                    if(err){
                        log.error(err);
                        bugsnag.notify(err);
                        reject(err);
                    }
                    let holidays = doc.days.map(elem => {
                        return elem.date;
                    });
                    moment.locale(doc.locale, {
                        holidays: holidays,
                        holidayFormat: doc.holidayFormat
                     });
                     dbService.close(db);
                     instance.moment = moment;
                     resolve(instance.moment);
                });
            }).catch(reason => {
                log.error(reason);
                bugsnag.notify(reason);
                db.close();
                reject(reason);
            })
        } catch (error) {
            if(dbi && dbi.serverConfig && dbi.serverConfig.isConnected()){
                dbi.close();
            }
            reject(error);
        }
    });
    
}

module.exports = {
    instance: instance
}
