var time_between_refresh = 60000; //time between refresh, 60s



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
var os = require('os');
var manifest = gui.App.manifest;
var opener = require('open');

var allNotifications = [];

if(gui.App.argv.indexOf('debug') != -1){
    win.showDevTools();
}
var gui = require('nw.gui');
var indexDealabsTimeout = 0;

// Create a tray icon
var tray = new gui.Tray({ title: 'Dealabs-notifier', tooltip: manifest.name , icon: 'img/icon.png' });
tray.on('click', function(){
    opener('http://dealabs.com');
})

// Create a Menu
var menu = new gui.Menu();

var notificationItem = new gui.MenuItem({ type: 'normal', label: 'Aucune notification', enabled : false, click : function(){opener('http://www.dealabs.com/notifications.html')} });
menu.append(notificationItem);

var alerteItem = new gui.MenuItem({ type: 'normal', label: 'Aucune alerte', enabled : false });
menu.append(alerteItem);

var MPItem = new gui.MenuItem({ type: 'normal', label: 'Aucun MP', enabled : false });
menu.append(MPItem);

menu.append(new gui.MenuItem({ type: 'separator'}));

var exitItem = new gui.MenuItem({ type: 'normal', label: 'Exit', click : function(){win.close();}.bind(this) });
menu.append(exitItem);
var copyrightItem = new gui.MenuItem({ type: 'normal', label: 'Par thib3113', enabled: false });
menu.append(copyrightItem);
var copyright2Item = new gui.MenuItem({ type: 'normal', label: 'non affilié à Dealabs', enabled: false });
menu.append(copyright2Item);
tray.menu = menu;

function destruct(){
    if(tray != null){
        // Remove the tray
        tray.remove();
        tray = null;
    }
    if(new_windows != true){
        new_windows.close();
    }
}

window.onbeforeunload=function(){
    destruct();
}
win.on('close', function() {
    console.log("close");
    this.hide();
    destruct();
    this.close(true);
});


function notify(title, text, icon, url){
    var options = {
        icon: icon,
        body: text
     };

    var notification = new Notification(title, options);

    if(typeof url != "undefined"){
        notification.onclick = function () {
            opener(this.url);
        }.bind({url:url})
        
    }
}



// Open dealabs

var new_windows = gui.Window.open ('http://dealabs.com', {
  position: 'center',
  width: screen.availWidth,
  height: screen.availHeight,
  show : false
});

new_windows.cb = function(cookies){
    jQuery = this.window.$;
    this.hide();
    nb_notif = parseInt(jQuery('.notif').text());
    try{
        nb_alertes = parseInt(jQuery("#alertes").text().match(/\(([0-9]*)\)/)[1]);
    }
    catch(e){
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

            async.map(current_notifs, function(item, cb){
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
                menuItem = new gui.MenuItem({ type: 'normal',
                    label: (this.nb_notif_commentaires == 0? "Aucune" : this.nb_notif_commentaires)+' notification'+(this.nb_notif_commentaires>1?"s":""),
                    click : function(){
                        opener('http://www.dealabs.com/notifications.html');
                    }
                });
                if(result.length>0){
                    submenu = new gui.Menu();
                    //on regarde si elles sont déjà affichés
                    for (var i = result.length - 1; i >= 0; i--) {
                        if(allNotifications.indexOf(result[i].url) == '-1'){
                            notify("Vous avez une nouvelle notification", result[i].text, result[i].icon, result[i].url);
                        }
                        new_allNotifications.push(result[i].url);

                        submenu.append(new gui.MenuItem({ label: result[i].text, click: function(){opener(this.url);}.bind({url:result[i].url}) }));
                    };
                    menuItem.submenu = submenu;
                }
                cb(null, menuItem);
            }.bind({nb_notif_commentaires:this.nb_notif_commentaires}));
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
                        opener('http://www.dealabs.com/alerts/alerts.html')
                    }
                });

                if(result.length>0){
                    submenu = new gui.Menu();
                    //on regarde si elles sont déjà affichés
                    for (var i = result.length - 1; i >= 0; i--) {
                        if(allNotifications.indexOf(result[i].url) == '-1'){
                            notify("Vous avez une nouvelle alerte", result[i].text, result[i].icon, result[i].url);
                        }
                        new_allNotifications.push(result[i].url);

                        submenu.append(new gui.MenuItem({ label: result[i].text, click: function(){opener(this.url);}.bind({url:result[i].url}) }));
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
                    opener($mpContainer.attr('src'))
                }
            });
            cb(null, menuItem);
        }
    }, function(err, menuItem){
        //update current notifications
        allNotifications = new_allNotifications;

        var menu = new gui.Menu();
        menu.append(menuItem.notifications);
        menu.append(menuItem.alertes);
        menu.append(menuItem.mp);

        menu.append(new gui.MenuItem({ type: 'separator'}));
        menu.append(exitItem);
        menu.append(copyrightItem);
        menu.append(copyright2Item);

        // update tray ?
        need_update = false;
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
                    break;
                }
            };
        };
        if(need_update)
            tray.menu = menu;
    })


    indexDealabsTimeout = setTimeout(function(){
        this.reload();
    }.bind(this), time_between_refresh);
}

new_windows.on('loaded', function(){
    var _self = this;
    if(this.window.location.hostname.match(/dealabs\.com$/) ){
        if(this.window.location.pathname == "/index.php" || this.window.location.pathname == "/"){
            this.cookies.getAll({}, function(cookies){
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
            });
        }
        else if(this.window.location.pathname == "/forum.html"){

        }
    }
});