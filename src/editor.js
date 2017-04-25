export default class Editor {
  constructor(ctrl) {
    this.ctrl = ctrl;
  }

  initEditMode() {
    this.ctrl.editMode = true;
    // TODO: use this.panelPath
    // determine the path to this plugin
    var panels = grafanaBootData.settings.panels;
    var thisPanel = panels[this.ctrl.pluginId];
    var thisPanelPath = thisPanel.baseUrl + '/';
    // add the relative path to the partial
    var optionsPath = thisPanelPath + 'partials/editor.options.html';
    this.ctrl.addEditorTab('Options', optionsPath, 2);
    var datatableOptionsPath = thisPanelPath +
      'partials/datatables.options.html';
    this.ctrl.addEditorTab('Datatable Options', datatableOptionsPath, 3);
  }

  changeState(fullscreen, edit) {
    if(edit) {
      this._enterEditMode();
    } else {
      this._exitEditMode();
    }
  }

  _enterEditMode() {
    //this.ctrl.editMode = true;
  }

  _exitEditMode() {
    //this.ctrl.editMode = false;
  }

}
