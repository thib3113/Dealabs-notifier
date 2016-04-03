var time_between_refresh = 30000; //time between refresh, 60s
var logLevel = 2; //2 = verbose, 1 = warnings, 0 = errors

////////////////////////
// DO NOT EDIT BELOW  //
////////////////////////
fs = require("fs");
path = require("path");
cookieParser = require("cookie");
var http = require('http');
var async = require('async');
var request = require('request');

var gui = require('nw.gui');
var win = gui.Window.get();
var debugMode = (gui.App.argv.indexOf('debug') != -1);
if(debugMode){
    win.showDevTools();
}


var os = require('os');
var manifest = gui.App.manifest;

// try{
//     require('scribe-js')({
//         rootPath:path.join(os.tmpdir(), manifest.name)
//     });
//     console = process.console;
    
// }
// catch(e){
//     console.error(e);
// }

var opener = require('open');
var __dirname = process.cwd();
var allNotifications = [];
var logger = new Logger(logLevel, manifest.name);
function Log(pMessage, pType, pStackTrace, pGroup){
    logger.log(pMessage, pType, pStackTrace, pGroup)
}

console.log('start');
memory = process.memoryUsage();
console.log('rss:'+memory.rss+', heapTotal:'+memory.heapTotal+', heapUsed:'+memory.heapUsed);

var indexDealabsTimeout = null;

var internWebBrowser = null;

var updateSuccess = false;

function openDLlinks(link){
    link = link || this.dlLink || null;
    
    if(link === null){
        debugger;
        return;
    }

    openLink(link);
    setTimeout(function(){
        fetcherWindows.reload();
    }, 2000)
}

function Settings(){
    _settings = {
        _useInternWebBrowser : null,
        _internWebBrowserStyle : null
    }
    this.toJSON=function(){
        return {
            useInternWebBrowser:this.useInternWebBrowser,
            internWebBrowserStyle:this.internWebBrowserStyle
        }
    }
    Object.defineProperty(this, 'useInternWebBrowser', {
        get: function() {
            if(_settings._useInternWebBrowser == null)
                _settings._useInternWebBrowser = this.getSettings().useInternWebBrowser || false;
            return _settings._useInternWebBrowser;
        },
        set: function(value) {
            _settings._useInternWebBrowser = value;
            this.updateSettings(this);
        }
    });
    Object.defineProperty(this, 'internWebBrowserStyle', {
        get: function() {
            if(_settings._internWebBrowserStyle == null)
                _settings._internWebBrowserStyle = this.getSettings().internWebBrowserStyle || "default";
            return _settings._internWebBrowserStyle;
        },
        set: function(value) {
            _settings._internWebBrowserStyle = value;
            this.updateSettings(this);
        }
    });

    this.getSettings=function (){
        try{
            cSettings=JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json')).toString());
        }
        catch(e){
            cSettings = {};
            Log(e, "error", true);
        }    
        return cSettings;
    };

    this.updateSettings=function(settings){
        curFile = fs.openSync(path.join(__dirname, 'config.json'), "w+");
        try{
            fs.writeSync(curFile, JSON.stringify(settings, null, 2));
        }
        catch(e){
            alert("One error appear when we will save setting file");
            Log(e, "error", true);
        }
        finally{
            fs.closeSync(curFile);
        }
    }
}

var settings = new Settings(); 

function openLink(link){
    if(!settings.useInternWebBrowser)
        opener(link);
    else{
        if(internWebBrowser == null){
            internWebBrowser = gui.Window.open(link, {
                position: 'center',
                width: screen.availWidth,
                height: screen.availHeight,
                show : false
            },
            function(nwWindow){
                setTheme = function(theme){                    
                    console.log("setTheme("+theme+")");
                    if(theme == "default"){
                        Array.prototype.forEach.call( this.window.document.querySelectorAll('[data-intern-web-browser="style"]'), function( node ) {
                            node.parentNode.removeChild( node );
                        });
                    }
                    else{
                        try{
                            var head = this.window.document.head
                              , style = this.window.document.createElement('style')

                            style.type = 'text/css';
                            style.innerHTML = fs.readFileSync(path.join(__dirname, "themes", theme+'.css')).toString();
                            style.dataset.internWebBrowser="style";
                            head.appendChild(style);

                            if(this.window.location.pathname.match(/^\/forum/) && files.indexOf(theme+"-forum.css") >= 0){
                                forumStyle = this.window.document.createElement('style');
                                forumStyle.type = 'text/css';
                                forumStyle.innerHTML = fs.readFileSync(path.join(__dirname, "themes", theme+'-forum.css')).toString();
                                forumStyle.dataset.internWebBrowser="style";
                                head.appendChild(forumStyle);
                            }
                        }
                        catch(e){
                            Log(e, "error", true);
                            console.error(e);
                        }
                    }
                }

                nwWindow.showDevTools();
                nwWindow.on('loading', function(){console.log('loading')});
                nwWindow.on('loaded', function(){console.log('loaded')});
                nwWindow.on('document-start', function(){console.log('document-start')});
                nwWindow.on('document-end', function(){
                    this.window.setTheme = setTheme;
                        // debugger;
                    setTheme(settings.internWebBrowserStyle);
                    console.log('document-end')}.bind(nwWindow));
                nwWindow.on('navigation', function(){console.log('navigation')});
                
                nwWindow.window.setTheme = setTheme;

                internWebBrowser = nwWindow;            
                internWebBrowser.on('close', function(){
                    this.close(true);
                    internWebBrowser=null;
                }.bind(internWebBrowser)); 
                internWebBrowser.on('loaded', function(e){
                    // debugger;
                    // this.window.setTheme(settings.internWebBrowserStyle);

                    this.show();
                    if(this.window.location.hostname.match(/dealabs\.com$/) ){
                        if(this.window.document.getElementById('login_conteneur_right_connected') != null){
                            updateNotifications(this.window.jQuery, this.window);
                        }
                    }

                    change_theme_menu_check=function(theme){
                        settings.internWebBrowserStyle = theme;
                        for (var i = 0; i < this.menu.items[0].submenu.items.length; i++) {
                            cItem = this.menu.items[0].submenu.items[i];
                            cItem.checked = false;
                            
                            if(cItem.label==theme){
                                cItem.checked = true;
                            }
                        };
                    }.bind(this);

                    // change_theme=function(theme){

                    // }.bind(this);

                    // //load setting theme
                    // change_theme(settings.internWebBrowserStyle);

                    //add theme options
                    try{
                        files = fs.readdirSync(path.join(__dirname, "themes"));
                        themes = [];
                        for(var i = 0; i < files.length; i++) {
                            if(themeName = files[i].match(/^([^-]*).css/))
                                themes.push(themeName[1]);
                        };

                        if(themes.length>0){
                            submenu = new gui.Menu();
                            //add default style
                            themes.splice(0, 0, "default");
                            for(var i = 0; i < themes.length; i++) {
                                submenu.append(
                                    new gui.MenuItem({
                                        type:'checkbox',
                                        label: themes[i],
                                        checked:settings.internWebBrowserStyle==themes[i],
                                        click:function(){
                                            this.fn(this.theme);
                                        }.bind({fn:function(theme){
                                            change_theme_menu_check(theme);
                                            change_theme(theme);
                                        }, theme:themes[i]})
                                    })
                                );
                            };
                            var menu = new gui.Menu({type: 'menubar'});
                            theme_menu = new gui.MenuItem({ label: 'Themes', submenu:submenu});
                            menu.append(theme_menu);
                            this.menu=menu;
                        }
                    }
                    catch(e){
                        Log(e, "error", true);
                        console.error(e);
                    }
                }.bind(internWebBrowser))
            });
        }
        else{
            internWebBrowser.window.location.href = link;
        }
    }
}

// Create a tray icon
var tray = new gui.Tray({ title: 'Dealabs-notifier', tooltip: manifest.name , icon: 'img/icon.png' });
tray.dlLink = 'http://dealabs.com';
tray.on('click', openDLlinks);
 // function(){
 //    openLink('http://dealabs.com');
 //    setTimeout(function(){
 //        this.fetcherWindows.reload();
 //    }.bind({fetcherWindows:fetcherWindows}), 2000)
// })

// Create a Menu
var menu = new gui.Menu();

var notificationItem = new gui.MenuItem(
    {
        type: 'normal',
        label: 'Aucune notification',
        enabled : false,
        click : function(){
            openDLlinks('http://www.dealabs.com/notifications.html');
        }
    }
);
menu.append(notificationItem);

var alerteItem = new gui.MenuItem({ type: 'normal', label: 'Aucune alerte', enabled : false });
menu.append(alerteItem);

var MPItem = new gui.MenuItem({ type: 'normal', label: 'Aucun MP', enabled : false });
menu.append(MPItem);

var forumItem = new gui.MenuItem({ type: 'normal', label: 'Aucun nouveau message', enabled : false });
menu.append(forumItem);

menu.append(new gui.MenuItem({ type: 'separator'}));
var useInternWebBrowser = new gui.MenuItem({ type: 'checkbox', label: 'Navigateur interne', checked:!!settings.useInternWebBrowser ,click : function(){settings.useInternWebBrowser = !settings.useInternWebBrowser}.bind(this) });
menu.append(useInternWebBrowser);

var exitItem = new gui.MenuItem({ type: 'normal', label: 'Fermer', click : function(){win.close();}.bind(this) });
menu.append(exitItem);
var copyrightItem = new gui.MenuItem({ type: 'normal', label: 'Par thib3113', enabled: false });
menu.append(copyrightItem);

var copyright2Item = new gui.MenuItem({ type: 'normal', label: 'non affilié à Dealabs', enabled: false });
menu.append(copyright2Item);
tray.menu = menu;

var fetcherWindows = {
    reload:function(){
    }
};

function destruct(){
    if(tray != null){
        // Remove the tray
        tray.remove();
        tray = null;
    }
    if(fetcherWindows != null){
        fetcherWindows.close();
    }
    if(internWebBrowser != null){
        internWebBrowser.close();
    }
}

window.onbeforeunload=function(){
    destruct();
}
win.on('close', function() {
    Log("close");
    win.hide();
    destruct();
    win.close(true);
});


var currentPopupNofification = {};
function notify(title, text, icon, url, slug){
    slug = slug || null;

    var options = {
        icon: icon,
        body: text
    };

    if(slug != null && typeof currentPopupNofification[slug] != "undefined" && currentPopupNofification[slug] instanceof Notification)
        currentPopupNofification[slug].close()

    Log("notify("+title+", "+text+", "+icon+", "+url+")");

    var notification = new Notification(title, options);

    if(slug != null)
        currentPopupNofification[slug] = notification;

    if(typeof url != "undefined"){
        notification.onclick = function () {
            openDLlinks(this.url);
            this.notification.close();
        }.bind({notification:notification, url:url});
    }


    // setTimeout(function(){
    //     this.notification.close();
    // }.bind({notification:notification}), 60000)
}

fetcherWindowsConfObject = {
  url : 'http://www.dealabs.com/forum/notifications.html',
  config : {
      position: 'center',
      width: screen.availWidth,
      height: screen.availHeight,
      show : false,
  },
  cb : function(cWindows){
        cWindows.on('error', function(a,b,c){
            debugger;
        })

        // if(debugMode)
        //     cWindows.showDevTools();

        fetcherWindows = cWindows;
        cWindows.cb = function(){
            cWindows.hide();
            updateNotifications(cWindows.window.$, cWindows.window);
        }
        cWindows.on('loaded', function(){
            if(cWindows.window.localStorage.getItem("knows_mobile_apps_exist") != true)
                cWindows.window.localStorage.setItem("knows_mobile_apps_exist", true);
                
            var _self = cWindows;
            if(cWindows.window.location.hostname.match(/dealabs\.com$/) ){
                cWindows.cookies.getAll({}, function(cookies){
                    authentified = false;
                    for( name in cookies){
                        if(cookies[name].name == "dealabs_token" && cookies[name].value != ""){
                            authentified = true;
                            break;
                        }
                    }
                    if(authentified){
                        _self.cb(cookies);
                    }
                    else{
                        _self.show();
                        _self.window.switch_display('#popup_center_login', '', 'show');
                    }
                }.bind(this));
            }
        })
    }
}

gui.Window.open(fetcherWindowsConfObject.url, fetcherWindowsConfObject.config ,fetcherWindowsConfObject.cb);

var lastForumMenuItem = null;

function updateNotifications(jQuery, current_window){
    Log("start update", null, null, "start");

    if(typeof jQuery == "undefined")
        throw new Error("you need to pass jQuery");

    //remove the timeout
    if(indexDealabsTimeout != null){
        Log("clearTimeout");
        clearTimeout(indexDealabsTimeout);
    }
    

    nb_notif = parseInt(jQuery('.notif').text());
    try{
        nb_alertes = parseInt(jQuery("#alertes").text().match(/\(([0-9]*)\)/)[1]);
    }
    catch(e){
        // Log(e, "error", true);
        nb_alertes = 0;
    }
    nb_notif_commentaires = nb_notif - nb_alertes;

    new_allNotifications = [];
    async.series({
        notifications: function(cb){
            //on récup les notifs 
            current_notifs = [];
            $notif_container = jQuery("#commentaires_part .item a.left_part_list");
            for (var i = $notif_container.length - 1; i >= 0; i--) {
                current_notifs.push({
                    text : jQuery($notif_container[i]).find('.text_color_blue').text(),
                    url  : jQuery($notif_container[i]).get(0).href,
                    icon : jQuery($notif_container[i]).find('img').get(0).src
                });
            };

            // async.map(current_notifs, function(item, cb){
            menuItem = new gui.MenuItem({ type: 'normal',
                label: (this.nb_notif_commentaires == 0? "Aucune" : this.nb_notif_commentaires)+' notification'+(this.nb_notif_commentaires>1?"s":""),
                click : function(){
                    openDLlinks('http://www.dealabs.com/notifications.html')
                }
            });
            if(current_notifs.length>0){
                submenu = new gui.Menu();
                //on regarde si elles sont déjà affichés
                for (var i = current_notifs.length - 1; i >= 0; i--) {
                    if(allNotifications.indexOf(current_notifs[i].url+current_notifs[i].text) == '-1'){
                        notify("Vous avez une nouvelle notification", current_notifs[i].text, current_notifs[i].icon, current_notifs[i].url, current_notifs[i].text);
                    }
                    new_allNotifications.push(current_notifs[i].url+current_notifs[i].text);

                    submenu.append(
                        new gui.MenuItem(
                            {
                                label: current_notifs[i].text,
                                click: function(){
                                    openDLlinks(this.url)
                                }.bind({url:current_notifs[i].url})
                            }
                        )
                    );
                };
                menuItem.submenu = submenu;
            }
            cb(null, menuItem);
        }.bind({nb_notif_commentaires:nb_notif_commentaires}),
        alertes: function(cb){
            //on récup les alertes 
            current_alertes = [];
            $alert_container = jQuery("#alertes_part .item a.left_part_list");
            for (var i = $alert_container.length - 1; i >= 0; i--) {
                current_alertes.push({
                    text : jQuery($alert_container[i]).find('.text_color_blue').text(),
                    url  : jQuery($alert_container[i]).get(0).href,
                    icon : jQuery($alert_container[i]).find('img').get(0).src
                });
            };

            async.map(current_alertes, function(item, cb){
                var imagePath = path.join(os.tmpdir(), path.join(manifest.name+'-'+path.basename(item.icon)));
                fs.access(imagePath, fs.F_OK, function(err) {
                    if (!err) {
                            item.icon = imagePath;
                            cb(null, item);                        
                    } else {
                        var r = request(item.icon);
                        r.cb = cb;
                        r.item = item;
                        r.on('response',  function (res) {
                           res.pipe(fs.createWriteStream(imagePath, {flag:"w+"})); 
                        });
                        r.on('end', function(){
                            this.item.icon = imagePath;
                            this.cb(null, this.item);
                        })
                    }
                }.bind({imagePath:imagePath}));
            }, 
            function(err, result){
                menuItem = new gui.MenuItem({
                    type: 'normal',
                    label: (this.nb_alertes == 0? "Aucune" : this.nb_alertes)+' alerte'+(this.nb_alertes>1?"s":""),
                    click : function(){
                        openDLlinks('http://www.dealabs.com/alerts/alerts.html');
                    }
                });

                if(result.length>0){
                    submenu = new gui.Menu();
                    //on regarde si elles sont déjà affichés
                    for (var i = result.length - 1; i >= 0; i--) {
                        if(allNotifications.indexOf(result[i].url+result[i].text) == '-1'){
                            notify("Vous avez une nouvelle alerte", result[i].text, result[i].icon, result[i].url, result[i].text);
                        }
                        new_allNotifications.push(result[i].url+result[i].text);

                        submenu.append(
                            new gui.MenuItem(
                                {
                                    label: result[i].text,
                                    click: function(){
                                        openDLlinks(this.url);
                                    }.bind({url:result[i].url})
                                }
                            )
                        );
                    };
                    menuItem.submenu = submenu;
                }
                cb(null, menuItem);
            }.bind({nb_alertes:this.nb_alertes}));
        }.bind({nb_alertes:nb_alertes}),
        mp: function(cb){
            $mpContainer = jQuery('.mp').first();
            nb_mp = parseInt($mpContainer.text());
            menuItem = new gui.MenuItem({
                type: 'normal',
                label: (nb_mp == 0? "Aucun" : nb_mp)+' MP'+(nb_mp>1?"s":""),
                click : function(){
                    openDLlinks(this.url);
                }.bind({url:$mpContainer.attr('href')})
            });
            $mps = jQuery('#messagerie_popup .item');
            if($mps.length>0)
              menuItem.click = function(){
                  openDLlinks(this.url)
              }.bind({url:jQuery('#messagerie_popup .button a').attr('href')});

            if(nb_mp > 0){
                submenu = new gui.Menu();
                for (var i = $mps.length - 1; i >= 0; i--) {
                  name_mp = jQuery($mps[i]).find('p:first()').text();
                  sender_mp = jQuery($mps[i]).find('span').text()
                  img = jQuery($mps[i]).find('img').attr('src');
                  link = jQuery($mps[i]).find('a').attr('href');

                  if(allNotifications.indexOf('mp-'+link+name_mp+' par '+sender_mp) == '-1')
                    notify("Nouveau message privé", name_mp+' par '+sender_mp, img, link, name_mp);
                  new_allNotifications.push('mp-'+link+name_mp+' par '+sender_mp);

                  submenu.append(
                      new gui.MenuItem(
                          {
                              label: text,
                              click: function(){
                                  openDLlinks(this.url);
                              }.bind({url:link})
                          }
                      )
                  );
                }
                menuItem.submenu = submenu;
            }            

            cb(null, menuItem);
        },
        forum: function(cb){
            menuItem = new gui.MenuItem({
                type: 'normal',
                label: "Aucun nouveau message",
                click : function(){
                    openDLlinks("http://www.dealabs.com/forum/notifications.html")
                }
            });

            if(this.location.pathname == "/forum/notifications.html"){
                $forumNotifContainer = jQuery('#body');
                $forumNotifs = $forumNotifContainer.find('.title_thread_contener');
                nb_notifs=$forumNotifs.length;
                menuItem.label = (nb_notifs == 0? "Aucun" : nb_notifs)+' nouveau'+(nb_notifs>1?'x':'')+' message'+(nb_notifs>1?"s":""); 
                if(nb_notifs>0){
                    submenu = new gui.Menu();
                    //on regarde si elles sont déjà affichés
                    for (var i = $forumNotifs.length - 1; i >= 0; i--) {
                        $notif = this.window.$($forumNotifs[i]);
                        notif = {
                            url : $notif.find('.title a:last').attr('href'),
                            icon : $notif.find('.img_bloc img').attr('src'),
                            title : $notif.find('.title').text().trim(),
                            author :$notif.find('.info_bloc a').text().trim()
                        }
                        if(allNotifications.indexOf(notif.title+notif.author) == '-1'){
                            notify("Nouveau message sur le forum", notif.title+" par "+notif.author, notif.icon, notif.url, notif.title);
                        }
                        new_allNotifications.push(notif.title+notif.author);

                        submenu.append(
                            new gui.MenuItem(
                                {
                                    label: notif.title+" par "+notif.author,
                                    click: function(){
                                        openDLlinks(this.url);
                                    }.bind({url:notif.url})
                                }
                            )
                        );
                    };
                    menuItem.submenu = submenu;
                }
                cb(null, menuItem);
            }
            else{
                if(lastForumMenuItem != null){
                    menuItem = lastForumMenuItem;
                }
                cb(null, menuItem);
            }
        }.bind(current_window)
    }, function(err, menuItem){
        //update current notifications
        allNotifications = new_allNotifications;

        var menu = new gui.Menu();
        menu.append(menuItem.notifications);
        menu.append(menuItem.alertes);
        menu.append(menuItem.mp);
        menu.append(menuItem.forum);

        menu.append(new gui.MenuItem({ type: 'separator'}));
        menu.append(useInternWebBrowser);
        menu.append(exitItem);
        menu.append(copyrightItem);
        menu.append(copyright2Item);

        // update tray ?
        need_update = false;
        //si c'est la première fois que l'on le lance
        try{
            if(tray.menu.items[0].enabled === false)
                need_update = true;
        }
        catch(e){
            Log(e, "error", true);
        }

        Log('notifications updated ?', null, null, 'start');
        for (var i = 0; i < menu.items.length; i++) {
            tmpLength = [];
            if(typeof tray.menu.items[i].submenu != "undefined" && typeof tray.menu.items[i].submenu.items != "undefined") 
                tmpLength.push(tray.menu.items[i].submenu.items.length);
            if(typeof menu.items[i].submenu != "undefined" && typeof menu.items[i].submenu.items != "undefined") 
                tmpLength.push(menu.items[i].submenu.items.length);

            length = tmpLength.sort().reverse()[0];
            for (var j = 0; j < length; j++) {
                try{
                    if(tray.menu.items[i].submenu.items[j].url == menu.items[i].submenu.items[j].url)
                        continue;
                    else{
                        need_update = true;
                        break;    
                    }
                }
                catch(e){
                    need_update = true;
                    // Log(e, "error", true);
                    break;
                }
            };
        };
        Log((need_update?"yes":"no"), null, false, 'end');
        if(need_update){
            Log("update tray", null, null, "start");
            for (var i = 0; i < menu.items.length; i++) {
                try{
                    if(typeof menu.items[i].submenu == "undefined")
                        Log(menu.items[i].label);
                    else
                        Log(menu.items[i].label, null, null, "start");
                        
                    //just for crash
                    for (var j = menu.items[i].submenu.items.length - 1; j >= 0; j--) {
                        Log(menu.items[i].submenu.items[j].label);
                    }
                    Log("", null, null, "end");
                }
                catch(e){
                    // Log(e, "error", true);
                }
            };
            Log("", null, null, "end");
            tray.menu = menu;
        }
        
        Log("setTimeout");
        // console.log('end');
        Log("endUpdate", null, null, "end");
        updateSuccess = true;

        reloadFunction = function(){
            if(!updateSuccess){
                if(debugMode)
                    notify('something is wrong', 'timeout restart without update, reopen');
                fetcherWindows.close();
                gui.Window.open(fetcherWindowsConfObject.url, fetcherWindowsConfObject.config ,fetcherWindowsConfObject.cb);
            }
            updateSuccess = false;
            memory = process.memoryUsage();
            console.log('rss:'+memory.rss+', heapTotal:'+memory.heapTotal+', heapUsed:'+memory.heapUsed);
            Log('startTimeout');
            global.gc();
            this.reload();
            Log('finishTimeout');
                indexDealabsTimeout = setTimeout(reloadFunction, time_between_refresh);
        }.bind(fetcherWindows)

        indexDealabsTimeout = setTimeout(reloadFunction, time_between_refresh);
    })
}


