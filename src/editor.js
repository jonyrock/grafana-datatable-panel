export default class Editor {
  constructor(datatablePanel) {
    this.panel = datatablePanel;
  }

  initEditMode() {
    console.log('initEditMode');
    console.log('this.panel.editMode');
    this.panel.editMode = true;
    // TODO: use this.panelPath
    // determine the path to this plugin
    var panels = grafanaBootData.settings.panels;
    var thisPanel = panels[this.panel.pluginId];
    var thisPanelPath = thisPanel.baseUrl + '/';
    // add the relative path to the partial
    var optionsPath = thisPanelPath + 'partials/editor.options.html';
    this.panel.addEditorTab('Options', optionsPath, 2);
    var datatableOptionsPath = thisPanelPath +
      'partials/datatables.options.html';
    this.panel.addEditorTab('Datatable Options', datatableOptionsPath, 3);
  }

  changeState(fullscreen, edit) {
    if(edit) {
      this._enterEditMode();
    } else {
      this._exitEditMode();
    }
  }

  _enterEditMode() {
    //this.panel.editMode = true;
  }

  _exitEditMode() {
    //this.panel.editMode = false;
  }

}
