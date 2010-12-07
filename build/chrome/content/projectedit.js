// Read strings from locale folder.
var gBundle = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
var swstrings = gBundle.createBundle("chrome://switcher/locale/switcher.properties");

var newproject = swstrings.GetStringFromName("NewProject");
var editproject = swstrings.GetStringFromName("EditProject");

// errors:
var lng_error = swstrings.GetStringFromName("Error");
var lng_NoProjectNameError = swstrings.GetStringFromName("NoProjectNameError");
var lng_WrongURISchemeError = swstrings.GetStringFromName("WrongURISchemeError");
var lng_ServerNameError = swstrings.GetStringFromName("ServerNameError");
var lng_DatabaseError = swstrings.GetStringFromName("DatabaseError");
var lng_DuplicateProjectNameError = swstrings.GetStringFromName("DuplicateProjectNameError");

var switcher_mDBConn = null;

var project_id = -1;

function switcher_trimString(s)
{
  return s.replace(new RegExp("^\\s+|\\s+$", "gi"), "");
}

// Saves the server
function switcher_saveProject()
{
    var project = switcher_trimString(document.getElementById("switcher.project").value);
    var devserver_scheme  = switcher_trimString(document.getElementById("switcher.devserver.scheme").value);
    var devserver_nameport  = switcher_trimString(document.getElementById("switcher.devserver.name").value).toLowerCase();
    var devserver_name = "";
    var devserver_port = -1;
    var devserver_path  = switcher_trimString(document.getElementById("switcher.devserver.path").value);
    var liveserver_scheme  = switcher_trimString(document.getElementById("switcher.liveserver.scheme").value);
    var liveserver_nameport  = switcher_trimString(document.getElementById("switcher.liveserver.name").value).toLowerCase();
    var liveserver_name = "";
    var liveserver_port = -1;
    var liveserver_path  = switcher_trimString(document.getElementById("switcher.liveserver.path").value);

    //var serverregex = /^(https?:\/\/|file:\/\/\/)?[^:/\\]+(:[0-9]*)?(\/[^/]+)*$/;

    var nameport_regex = /^([^:/\s\\]+)(:([0-9]+))?$/;
    //var path_regex = /^(\/[^/]+)*\/$/;

    if(project == "") {
      alert(lng_error+": "+lng_NoProjectNameError);
      return false;
    }

    if((devserver_scheme != "http" && devserver_scheme != "https" && devserver_scheme != "file" && devserver_scheme != "ftp" && devserver_scheme != "notes") ||
       (liveserver_scheme != "http" && liveserver_scheme != "https" && liveserver_scheme != "file" && liveserver_scheme != "ftp" && liveserver_scheme != "notes")) {
      alert(lng_error+": "+lng_WrongURISchemeError);
      return false;
    }

    if(devserver_scheme != "file") {
      var matches = devserver_nameport.match(nameport_regex);
      if(matches == null && !(devserver_scheme == "notes" && devserver_nameport == "")) { // server name for notes protocol optional
        alert(lng_error+": "+lng_ServerNameError);
        return false;
      }
      if(!(devserver_scheme == "notes" && devserver_nameport == "")) {
        devserver_name = matches[1];
        devserver_port = (matches[3] && !(devserver_scheme == "http" && matches[3] == "80") && !(devserver_scheme == "https" && matches[3] == "443") && !(devserver_scheme == "ftp" && matches[3] == "22")) ? matches[3] : -1;
      }
    }

    if(liveserver_scheme != "file") {
      var matches = liveserver_nameport.match(nameport_regex);
      if(matches == null && !(liveserver_scheme == "notes" && liveserver_nameport == "")) { // server name for notes protocol optional
        alert(lng_error+": "+lng_ServerNameError);
        return false;
      }
      if(!(liveserver_scheme == "notes" && liveserver_nameport == "")) {
        liveserver_name = matches[1];
        liveserver_port = (matches[3] && !(liveserver_scheme == "http" && matches[3] == "80") && !(liveserver_scheme == "https" && matches[3] == "443") && !(liveserver_scheme == "ftp" && matches[3] == "21")) ? matches[3] : -1;
      }
    }

    // replace backslashes by slashes in path
    devserver_path = devserver_path.replace(/\\/g, "/");
    liveserver_path = liveserver_path.replace(/\\/g, "/");

    if(devserver_path == "") devserver_path = "/";
    if(liveserver_path == "") liveserver_path = "/";
    if(devserver_path[0] != "/") devserver_path = "/"+devserver_path;
    if(liveserver_path[0] != "/") liveserver_path = "/"+liveserver_path;
    if(devserver_path[devserver_path.length-1] != "/") devserver_path = devserver_path+"/";
    if(liveserver_path[liveserver_path.length-1] != "/") liveserver_path = liveserver_path+"/";

    // save to db
    switcher_mDBConn.beginTransactionAs(switcher_mDBConn.TRANSACTION_DEFERRED);

    if(project_id == -1) { // new project
      var statement = switcher_mDBConn.createStatement(
        "INSERT INTO Server VALUES (?1, ?2, ?3, ?4)"
      );
      var statement2 = switcher_mDBConn.createStatement(
        "INSERT INTO Server VALUES (?1, ?2, ?3, ?4)"
      );
      var statement3 = switcher_mDBConn.createStatement(
        "INSERT INTO Project VALUES (?1, ?2, ?3)"
      );

      try {
        statement.bindStringParameter(0, devserver_scheme);
        statement.bindStringParameter(1, devserver_name);
        statement.bindInt32Parameter(2, devserver_port);
        statement.bindStringParameter(3, devserver_path);
        statement2.bindStringParameter(0, liveserver_scheme);
        statement2.bindStringParameter(1, liveserver_name);
        statement2.bindInt32Parameter(2, liveserver_port);
        statement2.bindStringParameter(3, liveserver_path);

        statement.execute();
        var devserver_id = switcher_mDBConn.lastInsertRowID;
        statement2.execute();
        var liveserver_id = switcher_mDBConn.lastInsertRowID;

        statement3.bindStringParameter(0, project);
        statement3.bindInt64Parameter(1, liveserver_id);
        statement3.bindInt64Parameter(2, devserver_id);

        statement3.execute();
      } catch(Exception) {
        alert(lng_error+": "+lng_DuplicateProjectNameError);
        switcher_mDBConn.rollbackTransaction();
        statement.reset();
        statement2.reset();
        statement3.reset();
        return false;
      }

      statement.reset();
      statement2.reset();
      statement3.reset();
    }
    else { // edit project
      var statement = switcher_mDBConn.createStatement(
        "UPDATE Project SET name = ?1 WHERE ROWID = ?2"
      );
      var statement2 = switcher_mDBConn.createStatement(
        "UPDATE Server SET scheme =?1, name = ?2, port = ?3, path = ?4  WHERE ROWID = (SELECT liveserver_id FROM Project WHERE ROWID = ?5)"
      );
      var statement3 = switcher_mDBConn.createStatement(
        "UPDATE Server SET scheme =?1, name = ?2, port = ?3, path = ?4  WHERE ROWID = (SELECT devserver_id FROM Project WHERE ROWID = ?5)"
      );

      try {
        statement.bindStringParameter(0, project);
        statement.bindInt32Parameter(1, project_id);
        statement.execute();

        statement2.bindStringParameter(0, liveserver_scheme);
        statement2.bindStringParameter(1, liveserver_name);
        statement2.bindInt32Parameter(2, liveserver_port);
        statement2.bindStringParameter(3, liveserver_path);
        statement2.bindStringParameter(4, project_id);
        statement2.execute();

        statement3.bindStringParameter(0, devserver_scheme);
        statement3.bindStringParameter(1, devserver_name);
        statement3.bindInt32Parameter(2, devserver_port);
        statement3.bindStringParameter(3, devserver_path);
        statement3.bindStringParameter(4, project_id);
        statement3.execute();

      } catch(Exception) {
        alert(lng_error+": "+lng_DatabaseError);
        switcher_mDBConn.rollbackTransaction();
        statement.reset();
        statement2.reset();
        statement3.reset();
        return false;
      }

      statement.reset();
      statement2.reset();
      statement3.reset();
    }

    switcher_mDBConn.commitTransaction();

    return true;
}

// Initializes the edit dialog box
function switcher_initializeProjectEdit()
{
  switcher_mDBConn = window.arguments[1];
  // If the first argument equals add
  if(window.arguments[0] == "new")
  {
    document.title = newproject;
    document.getElementById("switcher-server-dialog-caption").label = newproject;
  }
  else
  {
    document.title = editproject;

    project_id = window.arguments[2];

    var statement = switcher_mDBConn.createStatement(
      "SELECT Project.name, s_live.scheme, s_live.name, s_live.port, s_live.path, s_dev.scheme, s_dev.name, s_dev.port, s_dev.path "+
      "FROM Project JOIN Server s_live ON (Project.liveserver_id = s_live.ROWID) JOIN Server s_dev ON (Project.devserver_id = s_dev.ROWID) "+
      "WHERE Project.ROWID = ?1"
    );

    statement.bindInt32Parameter(0, project_id);

    while (statement.executeStep()) {
      var project = statement.getString(0);
      var live_scheme = statement.getString(1);
      var live_name = statement.getString(2);
      var live_port = statement.getInt32(3);
      var live_path = statement.getString(4);
      var dev_scheme = statement.getString(5);
      var dev_name = statement.getString(6);
      var dev_port = statement.getInt32(7);
      var dev_path = statement.getString(8);

      document.getElementById("switcher.project").value = project;

      document.getElementById("switcher.liveserver.scheme").value = live_scheme;
      switcher_schemeSelect('live');
      document.getElementById("switcher.liveserver.name").value = live_name;
      if(live_port != -1) document.getElementById("switcher.liveserver.name").value += ":"+live_port;
      document.getElementById("switcher.liveserver.path").value = live_path;

      document.getElementById("switcher.devserver.scheme").value = dev_scheme;
      switcher_schemeSelect('dev');
      document.getElementById("switcher.devserver.name").value = dev_name;
      if(dev_port != -1) document.getElementById("switcher.devserver.name").value += ":"+dev_port;
      document.getElementById("switcher.devserver.path").value = dev_path;

    }
    statement.reset();
  }
}

function switcher_schemeSelect(origin)
{
  if(origin != 'dev' && origin != 'live')
    return;

  if(document.getElementById("switcher."+origin+"server.scheme").value == 'file') {
    document.getElementById("switcher."+origin+"server.name").value = '';
    document.getElementById("switcher."+origin+"server.name").disabled = true;
  } else {
    document.getElementById("switcher."+origin+"server.name").disabled = false;
  }
}
