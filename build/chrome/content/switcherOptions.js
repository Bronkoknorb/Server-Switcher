var switcher_mDBConn = null;

var gBundle = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
var swstrings = gBundle.createBundle("chrome://switcher/locale/switcher.properties");

// errors:
var lng_error = swstrings.GetStringFromName("Error");
var lng_DatabaseError = swstrings.GetStringFromName("DatabaseError");


// Adds Project
function switcher_addProject()
{
  window.openDialog("chrome://switcher/content/projectedit.xul", "switcher-server-dialog", "centerscreen,chrome,modal", "new", switcher_mDBConn);

  switcher_loadProjects();
}


// Edits Project
function switcher_editProject()
{
    var listBox    = document.getElementById("switcher-listbox");
    var selectedItem = listBox.selectedItem;

    // If an option is selected
    if(selectedItem)
    {
        window.openDialog("chrome://switcher/content/projectedit.xul", "switcher-server-dialog", "centerscreen,chrome,modal", "edit", switcher_mDBConn, selectedItem.getAttribute("value"));

        switcher_loadProjects();
    }
}

// Initializes Options dialog
function switcher_initializeOptions()
{
  var file = Components.classes["@mozilla.org/file/directory_service;1"]
                   .getService(Components.interfaces.nsIProperties)
                   .get("ProfD", Components.interfaces.nsIFile);
  file.append("serverswitcher.sqlite");

  var storageService = Components.classes["@mozilla.org/storage/service;1"]
                          .getService(Components.interfaces.mozIStorageService);
  switcher_mDBConn = storageService.openDatabase(file);

  switcher_loadProjects();
  switcher_listBoxSelected();
}

// loads projects into listbox
function switcher_loadProjects()
{
  var pageDocument     = document;
  var listBox        = pageDocument.getElementById("switcher-listbox");

  // remove all listitems
  while(listBox.lastChild.nodeName == "listitem") {
    listBox.removeChild(listBox.lastChild);
  }

  var statement = switcher_mDBConn.createStatement(
    "SELECT Project.name, s_live.scheme, s_live.name, s_live.port, s_live.path, s_dev.scheme, s_dev.name, s_dev.port, s_dev.path, Project.ROWID "+
    "FROM Project JOIN Server s_live ON (Project.liveserver_id = s_live.ROWID) JOIN Server s_dev ON (Project.devserver_id = s_dev.ROWID)"
  );

  while (statement.executeStep()) {
    var project_id = statement.getString(9);
    var project = statement.getString(0);
    var live_scheme = statement.getString(1);
    var live_name = statement.getString(2);
    var live_port = statement.getInt32(3);
    var live_path = statement.getString(4);
    var dev_scheme = statement.getString(5);
    var dev_name = statement.getString(6);
    var dev_port = statement.getInt32(7);
    var dev_path = statement.getString(8);

    var liveserver = live_scheme+"://"+live_name+((live_scheme!="file"&&live_port!=80&&live_port!=-1)?(":"+live_port):"")+live_path;
    var devserver = dev_scheme+"://"+dev_name+((dev_scheme!="file"&&dev_port!=80&&dev_port!=-1)?(":"+dev_port):"")+dev_path;

    var listItem = pageDocument.createElement("listitem");
    listItem.setAttribute("value", project_id);

    var listCell = pageDocument.createElement("listcell");
    listCell.setAttribute("label", project);
    listItem.appendChild(listCell);

    listCell = pageDocument.createElement("listcell");
    listCell.setAttribute("label", devserver);
    listItem.appendChild(listCell);

    listCell = pageDocument.createElement("listcell");
    listCell.setAttribute("label", liveserver);
    listItem.appendChild(listCell);

    listBox.appendChild(listItem);
  }

  statement.reset();

}

// Called whenever list box is selected
function switcher_listBoxSelected()
{
    var pageDocument   = document;
    var deleteButton   = pageDocument.getElementById("switcher-delete");
    var editButton     = pageDocument.getElementById("switcher-edit");
    var listBox        = pageDocument.getElementById("switcher-listbox");

    // If an item is selected
    if(listBox.selectedItem)
    {
        deleteButton.disabled   = false;
        editButton.disabled     = false;
    }
    else
    {
        deleteButton.disabled   = true;
        editButton.disabled     = true;
    }
}

// Deletes a resize option
function switcher_deleteProject()
{
    var pageDocument = document;
    var resizeBox    = pageDocument.getElementById("switcher-listbox");
    var selectedItem = resizeBox.selectedItem;
    var project_id = selectedItem.getAttribute("value");

    switcher_mDBConn.beginTransactionAs(switcher_mDBConn.TRANSACTION_DEFERRED);

    var statement = switcher_mDBConn.createStatement(
      "DELETE FROM Project WHERE ROWID = ?1"
    );
    var statement2 = switcher_mDBConn.createStatement(
      "DELETE FROM Server WHERE ROWID = (SELECT liveserver_id FROM Project WHERE ROWID = ?1)"
    );
    var statement3 = switcher_mDBConn.createStatement(
      "DELETE FROM Server WHERE ROWID = (SELECT devserver_id FROM Project WHERE ROWID = ?1)"
    );
    try {
      statement.bindInt64Parameter(0, project_id);
      statement2.bindInt64Parameter(0, project_id);
      statement3.bindInt64Parameter(0, project_id);
      statement.execute();
      statement2.execute();
      statement3.execute();
    } catch(Exception) {
      alert(lng_error+": "+lng_DatabaseError);
      switcher_mDBConn.rollbackTransaction();
      statement.reset();
      statement2.reset();
      statement3.reset();
      return;
    }

    switcher_mDBConn.commitTransaction();
    statement.reset();
    statement2.reset();
    statement3.reset();

    switcher_loadProjects();
}


function switcher_saveOptions() {
}
