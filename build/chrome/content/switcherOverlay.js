/**
 * Listens for page turn events as well as
 * maintaining server info structures for each tab.
 */
function SwitcherListener() {
    this.tabContexts = new Array(); //this array stores the information for each tab.
    this.mDBConn = null;
}

/**
 * Called when the browser is actually up and loaded
 */
SwitcherListener.prototype.Initialize = function(aEvent) {
    // Only load if this is the chrome load event
    if (aEvent.originalTarget != document) {
        return;
    }

    var file = Components.classes["@mozilla.org/file/directory_service;1"]
                     .getService(Components.interfaces.nsIProperties)
                     .get("ProfD", Components.interfaces.nsIFile);
    file.append("serverswitcher.sqlite");

    var storageService = Components.classes["@mozilla.org/storage/service;1"]
                            .getService(Components.interfaces.mozIStorageService);
    this.mDBConn = storageService.openDatabase(file);

    /* create databases (if not existing) */
      /* TODO: name aus Project als PRIMARY KEY? -> project_id aus more_servers_rel anpassen! */
    this.mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS Project (name TEXT PRIMARY KEY, liveserver_id INTEGER, devserver_id INTEGER)");
    this.mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS Server (scheme TEXT, name TEXT, port INTEGER, path TEXT)");
      /* TODO: more_servers_rel: wechsel zu welchem Server? welches icon? in EER-Diagramm anpassen! */
    //this.mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS more_servers_rel (project_id INTEGER, server_id INTEGER, UNIQUE(project_id, server_id))");
    this.mDBConn.executeSimpleSQL("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)");

    this.mDBConn.executeSimpleSQL("INSERT OR IGNORE INTO settings VALUES ('db_version', '0.5')");
    /* TODO: Update DB, if version changes */

    // Make sure we hear about page turn events
    var contentArea = document.getElementById("content");
    contentArea.addProgressListener(ServerSwitcher, Components.interfaces.nsIWebProgress.NOTIFY_ALL);

    window.addEventListener("keypress", function(event) {
      ServerSwitcher.handleEvent(event);
    }, true);
}

/**
 * Called when the browser is closing down
 */
SwitcherListener.prototype.Destroy = function(aEvent) {
  if (aEvent.originalTarget != document) {
    return;
  }

  // Unhook this listener from browser
  var contentArea = document.getElementById("content");
  contentArea.removeProgressListener(ServerSwitcher);
}


/**
 * This fires when the location bar changes (either a new page or a new tab)
 */
SwitcherListener.prototype.onLocationChange = function(aProgress, aRequest, aURI) {
  // Make sure icon is hidden
  ServerSwitcher.DisableDisplay();

  // Don't do anything If we're not on a valid page (empty tab, about:blank, etc)
  if (aURI == null || (aURI.scheme != "http" && aURI.scheme != "https" && aURI.scheme != "file" && aURI.scheme != "ftp" && aURI.scheme != "notes")) {
    return;
  }

  // Walk through our array of contexts, see if this is a page turn for an
  // existing tab
  var contentArea = document.getElementById("content");
  var currentBrowser = contentArea.selectedBrowser;
  var foundContext = -1;
  for (var i = 0; i < this.tabContexts.length; i++) {
    if (this.tabContexts[i].browser == currentBrowser) {
      foundContext = i;
      break;
    }
  }


  // If this is a new tab add it now
  if (foundContext == -1) {

    // While we're here, clean up any tabContexts that no longer have a matching
    // tab in the browser
    for (var i = 0; i < this.tabContexts.length; i++) {
      var tabExists = false;
      for (j = 0; j < contentArea.browsers.length; j++) {
        if (contentArea.browsers[j] == this.tabContexts[i].browser) {
          tabExists = true;
          break;
        }
      }

      // Couldn't find a browser tab for this context, remove this context
      if (!tabExists) {
        var removedContext = this.tabContexts.splice(i, 1);
        removedContext[0].Destroy();

        // We need to check this index again
        i--;
      }
    }

    // Append a new tab context
    var newContext = new ServerSwitcherTabData(currentBrowser);
    this.tabContexts[this.tabContexts.length] = newContext;
    foundContext = this.tabContexts.length - 1;
  }

  // Select the info for the current context and get it going
  var currentServerSwitcherTabData = this.tabContexts[foundContext];
  currentServerSwitcherTabData.LocationChange(aURI);

  return;
}

/**
 * Disables display elements
 */
SwitcherListener.prototype.DisableDisplay = function() {
  var icon = document.getElementById("switcher_icon");
  if (icon) {
    var iconContainer = icon.parentNode;
    iconContainer.removeChild(icon);
  }
}

/**
 * Enables icon
 */
SwitcherListener.prototype.EnableDisplay = function(displayNode, toolTipText) {
    // Kill it if it's already enabled
    ServerSwitcher.DisableDisplay();

    // Add icon
    var URLBarHbox = document.getElementById("urlbar-icons");
    URLBarHbox.appendChild(displayNode);
    displayNode.addEventListener("click", function(event) {
      ServerSwitcher.handleEvent(event);
    }, false);

    // Set tooltips
    if (toolTipText) {
        document.getElementById("switcher_icon").setAttribute("tooltiptext", toolTipText);
    }
}

/**
 * Called when the user clicks on the icon or presses key combo
 */
SwitcherListener.prototype.handleEvent = function(event) {
  var newtab = false; // open in new tab?
  if(event.button == 1 || (event.button == 0 && (event.ctrlKey || event.metaKey))) { // middle button or CTRL+leftclick or CMD+leftclick
    newtab = true;
  }
  else if(event.button == 0 || (event.ctrlKey && event.shiftKey && event.charCode == '88')); // left mouse or key combo
  else return; // other button? no action.

  var contentArea = document.getElementById("content");
  var currentBrowser = contentArea.selectedBrowser;

  var foundContext = -1;
  for (var i = 0; i < this.tabContexts.length; i++) {
    if (this.tabContexts[i].browser == currentBrowser) {
      foundContext = i;
      break;
    }
  }

  if(foundContext == -1 || (this.tabContexts[i].devserver==false && this.tabContexts[i].liveserver==false)) return; // Context not found or not switchable server

  var newurl = this.tabContexts[i].switchurl;

  // Redirect the browser
  if(newtab) {
    var browser = getBrowser();
    var newtab = browser.addTab(newurl);
    browser.selectedTab = newtab; // focus the new tab
  }
  else getBrowser().loadURI(newurl);
}

SwitcherListener.prototype.onStateChange = function() { }
SwitcherListener.prototype.onProgressChange = function() { }
SwitcherListener.prototype.onStatusChange = function() { }
SwitcherListener.prototype.onSecurityChange = function() { }
SwitcherListener.prototype.onLinkIconAvailable = function() { }

SwitcherListener.prototype.QueryInterface = function(aIID) {
 if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
     aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
     aIID.equals(Components.interfaces.nsISupports))
   return this;
 throw Components.results.NS_NOINTERFACE;
}



/**
 * ServerSwitcher manages one ServerSwitcherTabData object for each browser tab.
 */
function ServerSwitcherTabData(aBrowser) {
  this.uri = null;  // The current uri (http://www.xulplanet.com/references/xpcomref/ifaces/nsIURI.html)
  this.switchuri = null; // uri for switching (String)
  this.devserver = false; // this is a dev-server
  this.liveserver = false; // this is a live-server
  this.browser = aBrowser;
  this.mainElement = null;
}

/**
 * Clean up TabData
 */
ServerSwitcherTabData.prototype.Destroy = function() {
  this.uri = null;
  this.switchuri = null;
  this.devserver = false;
  this.liveserver = false;
  this.browser = null;
  this.mainElement = null;
}

/**
 * Given a new URL, check if it is dev- or live-server
 */
ServerSwitcherTabData.prototype.LocationChange = function(aURI) { // (aURI: http://www.xulplanet.com/references/xpcomref/ifaces/nsIURI.html)
    // Don't do anything if this site is the same as the previous
    if (this.uri != null && aURI.spec == this.uri.spec) {

        // If the current site has an icon, make it visible
        if (this.mainElement) {
            ServerSwitcher.EnableDisplay(this.mainElement, null);
        } else {
            ServerSwitcher.DisableDisplay();
        }
        // save the current uri
        this.uri = aURI;
        return;
    }

    this.uri = aURI;
    this.switchuri = null;
    this.devserver = false;
    this.liveserver = false;
    this.mainElement = null;

    // Check if this is a dev- or live-server
    var statement = mDBConn.createStatement(
      "SELECT type, scheme, name, port, path, scheme2, name2, port2, path2 FROM("+
        "SELECT 'live' as type, Server.scheme as scheme, Server.name as name, Server.port as port, Server.path as path, s2.scheme as scheme2, s2.name as name2, s2.port as port2, s2.path as path2 "+
        "FROM Project JOIN Server ON Project.liveserver_id = Server.ROWID JOIN Server s2 ON Project.devserver_id = s2.ROWID "+
        "UNION "+
        "SELECT 'dev' as type, Server.scheme as scheme, Server.name as name, Server.port as port, Server.path as path, s2.scheme as scheme2, s2.name as name2, s2.port as port2, s2.path as path2 "+
        "FROM Project JOIN Server ON Project.devserver_id = Server.ROWID JOIN Server s2 ON Project.liveserver_id = s2.ROWID) "+
      "WHERE scheme = ?1 AND (scheme = 'file' OR (name = ?2 AND port = ?3))"
    );

    //alert(aURI.spec + " Scheme:"+aURI.scheme+" Host:"+aURI.host+" Port:"+aURI.port+" Path:"+aURI.path);
    statement.bindStringParameter(0, aURI.scheme);
    statement.bindStringParameter(1, aURI.host);
    if(aURI.scheme == "http" && aURI.port == 80) aURI.port = -1;
    if(aURI.scheme == "https" && aURI.port == 443) aURI.port = -1;
    if(aURI.scheme == "ftp" && aURI.port == 21) aURI.port = -1;
    statement.bindInt32Parameter(2, aURI.port);

    while (statement.executeStep()) {
      var type = statement.getString(0);
      var path = statement.getString(4);
      var switchscheme = statement.getString(5);
      var switchhost = statement.getString(6);
      var switchport = statement.getString(7);
      var switchpath = statement.getString(8);

      var matches = null;
      if((matches = this.uri.path.match(new RegExp("^"+path.replace(/\./g, '\\.')+"(.*)", "i"))) != null) {
        this.switchurl = switchscheme+"://"+switchhost+((switchscheme!="file"&&switchport!=-1)?(":"+switchport):"")+switchpath + matches[1];

        //alert(this.switchurl);

        if(type == "live") this.liveserver = true;
        else this.devserver = true;

        break;
      }

    }

    statement.reset(); // unlocks database

    if(this.devserver || this.liveserver) {
        // Build a new server button

        var switcherURLBarButton = document.createElement("image");

        if(this.devserver) switcherURLBarButton.setAttribute("class", "urlbar-icon devserver");
        else switcherURLBarButton.setAttribute("class", "urlbar-icon liveserver");

        switcherURLBarButton.setAttribute("id", "switcher_icon");

        // Save button for future tab changes
        this.mainElement = switcherURLBarButton;

        ServerSwitcher.EnableDisplay(this.mainElement, "Switch to "+this.switchurl);
    }
    else {
        ServerSwitcher.DisableDisplay();
    }
}
