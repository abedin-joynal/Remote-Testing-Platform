var dateTime = require('node-datetime');
const sqlite3 = require('sqlite3').verbose();
const db_name = 'db/adc_rtl.db';
var db;
class DB
{
    constructor() {
        this.connect();
    }

    connect() {
        db = new sqlite3.Database(db_name, (err) => {
            if (err) {
                return console.error(err.message);
            }
            console.log('Connected to the SQlite database.');
        });
        return db;
    }

    getConnectionInfoByID(id) {
        return new Promise(function (resolve, reject) {
            db.all("SELECT * FROM Connections where id='"+id+"'", function(err, rows) {
               resolve(rows)
            });	
        });	
    }

    getConnectionsByIP(ip) {
        return new Promise(function (resolve, reject) {
            db.all("SELECT * FROM Connections where ip='"+ip+"'", function(err, rows) {
               resolve(rows)
            });	
        });	
    }

    addNewConnection(con_info) {
        return new Promise(function (resolve, reject) {
            db.run("INSERT INTO Connections (connection_name, ip, port, baudrate, parity, stopbits, databits) values(?,?,?,?,?,?,?)", 
            [con_info.connection_name, con_info.ip, con_info.port, con_info.baudrate, con_info.parity, con_info.stopbits, con_info.databits], function(err) {
                if(null == err) {
                    resolve(this.lastID);
                } else {
                    console.log(err);
                    reject(err)
                }
            });
        });
    }

    updateConnection(con_info) {
        return new Promise(function (resolve, reject) {
            let sql = "UPDATE Connections SET port='"+con_info.port+"', baudrate='"+con_info.baudrate+"', parity='"+con_info.parity+"', stopbits='"+con_info.stopbits+"', databits='"+con_info.databits+"' where id='"+con_info.connection_id+"'"
            db.run(sql, function(err, rows) {
               if(err) {
                   console.log(err)
                   reject(err)
               } 
               resolve(true)
            });	
        });	
    }

    closeExistingConnections(){
        return new Promise(function (resolve, reject) {
            let sql = "UPDATE Connection_log SET status='0' where status='1'";
            // console.log(sql)
            db.run(sql, function(err, rows) {
                if(err) {
                    console.log(err)
                    reject(err)
                } 
                resolve(true)
            });	
        });
    }

    enableConnectionById(id) {
        console.log(id)
        return new Promise(function (resolve, reject) {
            let sql = "UPDATE Connections SET status='1' where id='"+id+"'"
            db.run(sql, function(err, rows) {
                if(err) {
                   console.log(err)
                   reject(err)
                } 
               resolve(true)
            });	
        });	
    }

    disableConnectionsByIP(ip) {
        return new Promise(function (resolve, reject) {
            let sql = "UPDATE Connections SET status='0' where ip='"+ip+"'"
            db.run(sql, function(err, rows) {
               if(err) {
                   console.log(err)
                   reject(err)
               } 
               resolve(true)
            });	
        });	
    }

    getActiveConnectionsByIP(ip, port) {
        return new Promise(function (resolve, reject) {
            let sql = "SELECT id FROM Connections where ip='"+ip+"' AND port='"+port+"'"
            // console.log(sql)
            db.all(sql, function(err, rows) {
               if(err) {
                   console.log(err)
                   reject(err)
               }
               resolve(rows)
            });	
        });	
    }

    addNewConnectionLog(con_id) {
        var start_time = dateTime.create().format('Y-m-d H:M:S');
        return new Promise(function (resolve, reject) {
            db.run("INSERT INTO Connection_log (con_id, status, con_start_time, con_end_time) values(?,?,?,?)", 
            [con_id, 1, start_time, null], function(err) {
                if(null == err) {
                    resolve(this.lastID);
                } else {
                    console.log(err);
                    reject(err)
                }
            });
        });
    }

    // disableConnectionsLog(con_id) {
    //     this.getActiveConnectionLog(con_id).then((last_c_log_id) => {
    //         if(last_c_log_id) {
    //             // console.log(last_c_log_id)
    //             var end_time = dateTime.create().format('Y-m-d H:M:S');
    //             return new Promise(function (resolve, reject) {
    //                 let sql = "UPDATE Connection_log SET status='0', con_end_time='"+end_time+"' where id='"+last_c_log_id+"'"
    //                 // console.log(sql)
    //                 db.run(sql, function(err, rows) {
    //                     if(err) {
    //                         console.log(err)
    //                         reject(err)
    //                     } 
    //                     resolve(true)
    //                 });	
    //             });	
    //         }
    //     })
    // }
    disableConnectionsLog(ip, port){
        var end_time = dateTime.create().format('Y-m-d H:M:S');
        return new Promise(function (resolve, reject) {
            let sql = "UPDATE Connection_log SET status='0', con_end_time='"+end_time+"' where status='1' and con_id=(select id from connections where ip='"+ip+"' and port='"+port+"')";
            db.run(sql, function(err, rows) {
                if(err) {
                    console.log(err)
                    reject(err)
                } 
                resolve(true)
            });	
        });
    }
    // update Connection_log set status=0 where status =1 and con_id=(select id from connections where ip='107.109.213.136' and port='/dev/ttyUSB0'); 

    getActiveConnectionLog(con_id) {
        return new Promise(function (resolve, reject) {
            let sql = "SELECT id FROM Connection_log where con_id='"+con_id+"' ORDER BY id DESC LIMIT 1"
            // console.log(sql)
            db.all(sql, function(err, row) {
            //    console.log(row)
               if(err) {
                   console.log(err)
                   reject(err)
               }
               if(typeof row[0] !== 'undefined') {
                // does not exist
                 resolve(row[0].id)
               } else {
                   resolve(false)
               }
            });	
        });
    }

    getOccupiedPortList(){
        return new Promise(function (resolve, reject) {
            let sql = "select port from Connections where id in (select con_id from Connection_log where status=1)"
            db.all(sql, function(err, row) {
            //    console.log(row)
               if(err) {
                   console.log(err)
                   reject(err)
               }
               if(typeof row !== 'undefined') {
                // does not exist
                 resolve(row)
               } else {
                   resolve(false)
               }
            });	
        });
    }

    deleteConnectionById(con_id) {
        return new Promise(function (resolve, reject) {
            let sql = "DELETE FROM Connections WHERE id='" + con_id + "'"
            db.run(sql, function(err, rows) {
               if(err) {
                   console.log(err)
                   reject(err)
               } 
               resolve(true)
            });	
        });	
    }

    closeCon() {
        db.close();
    }

    getCamByPort(port) {
        return new Promise(function (resolve, reject) {
            let sql = "SELECT cam FROM Cam_port_map WHERE port='"+port+"' LIMIT 1"
            db.all(sql, function(err, row) {
                if(err) {
                    reject(err)
                }
                if(typeof row !== 'undefined') {
                    resolve(row[0])
                } else {
                    resolve(false)
                }
            });	
        });
    }
}

/* rows.forEach(function (row) {
    console.log(row.connection_name, row.ip);
})*/
module.exports = DB