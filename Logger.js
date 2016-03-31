var fs = require("fs");
var os = require("os");
var path = require('path');
var dateFormat = require('dateFormat');

function Logger(pLogLevel, pFolderName){
    var _self = this;
    this.folderName = pFolderName || 'log';
    this.logs = [];
    this.logLevels = {
        "error" : 0,
        "warning" : 1,
        "verbose" : 2
    };
    this.group = 0;

    this.helper = {

      STR_PAD_LEFT : 1,
      STR_PAD_RIGHT : 2,
      STR_PAD_BOTH : 3,

      //pad left
      pad : function(str, len, pad, dir) {
        if (typeof(len) == "undefined") { var len = 0; }
        if (typeof(pad) == "undefined") { var pad = ' '; }
        if (typeof(dir) == "undefined") { var dir = this.STR_PAD_RIGHT; }

        if (len + 1 >= str.length) {
          switch (dir){
            case this.STR_PAD_LEFT:
              str = Array(len + 1 - str.length).join(pad) + str;
            break;
            case this.STR_PAD_BOTH:
                var right = Math.ceil((padlen = len - str.length) / 2);
                var left = padlen - right;
                str = Array(left+1).join(pad) + str + Array(right+1).join(pad);
            break;
            case this.STR_PAD_RIGHT:
            default:
                str = str + Array(len + 1 - str.length).join(pad);
            break;
          } // switch
        }
        return str;
      }
    }
    
    /**
     * Loglevel
     * @type [0|1|2] see logLevels
     */
    this.logLevel = pLogLevel || 2;

    this._getLogLevel=function(type){
        return type || "verbose";
    }
    this.log=function(pMessage, pType, pStackTrace, pGroup){
        // console.log("logger.log");
        level = _self._getLogLevel(pType);

        if(level > _self.logLevel)
            return;

        if(pGroup == "end"){
            this.group -= 2;
            console.groupEnd();
        }

        stackTrace = pStackTrace || null;
        message = pMessage || "undefined";

        if(pMessage === NaN){
            message = "NaN";
        }

        if(typeof pMessage.name == "string" && pMessage.name.match(/Error/)){
            if(stackTrace === null)
                stackTrace = pMessage.stack;
            message = pMessage.message;
        }

        switch(level){
            case "error":
                type_class = "danger";
                if(pGroup != "start")
                    console.error(message);
            break;
            case "warning":
                type_class = "warning";
                if(pGroup != "start")
                    console.warn(message);
            break;
            default:
                type_class = "info";
                if(pGroup != "start")
                    console.log(message);
            break;
        }

        if(typeof stackTrace == "boolean"){
            console.trace();
        }
        else if(stackTrace){
            console.log(message, stackTrace)
        }
        time = Date.now();
        strTime = dateFormat(time, "yyyy-mm-dd HH:MM:ss.l");
        
        cLog = {
            time: time,
            message: " ".repeat(this.group)+message,
            level: this.helper.pad(level, 7 , ' ', this.helper.STR_PAD_BOTH)
        };
        _self.logs.push(cLog);
        _self._writeLog(cLog);
        if(pGroup == "start"){
            this.group += 2;
            console.group(pMessage);
        }
    }

    this._writeLog = function(pLog, index){
        index = index++ || 1;
        tmpdir = os.tmpdir();
        try{
            //check folder exist
            fs.statSync(path.join(tmpdir, this.folderName));
            writeLogsReady=true;
        }
        catch(e){
            if(e.errno == -4058){
                try{
                    fs.mkdirSync(path.join(tmpdir, this.folderName));
                }
                catch(e){
                    alert(e.message);
                    throw e;
                }
            }
        }
        try{
            file = path.join(tmpdir, this.folderName, "log"+index+".log");
            //check file exist
            stat = fs.statSync(file);
            if(stat["size"] > 1e+7){
                _self._writeLog(pLog, index);
            }
            else{
                curFile = fs.openSync(file, "a+");
                time = new Date(pLog.time);
                strTime = dateFormat(time, "dd/mm/yy HH:MM:ss.l");
                try{
                    fs.writeSync(curFile, '['+pLog.level+']['+strTime+'] '+pLog.message+'\n');
                }
                finally{
                    fs.closeSync(curFile);
                }
            }
        }
        catch(e){
            file = path.join(tmpdir, this.folderName, "log"+index+".log");
            
            curFile = fs.openSync(file, "a+");
            time = new Date(pLog.time);
            strTime = dateFormat(time, "dd/mm/yy HH:MM:ss");
            try{
                fs.writeSync(curFile, '['+pLog.level+']['+strTime+'] '+pLog.message+'\n');
            }
            finally{
                fs.closeSync(curFile);
            }
        }
    }
}
