import { CSSStylesManager } from './css-styles';
import { DatatableRenderer } from './renderer';
import Editor from './editor';
import * as Transformers from './transformers';
import * as ColumnStyles from './column-styles';

import { MetricsPanelCtrl } from 'app/plugins/sdk';
import kbn from 'app/core/utils/kbn';
import * as FileExport from 'app/core/utils/file_export';

import $ from 'jquery';


const panelDefaults = {
  targets: [{}],
  transform: 'timeseries_to_columns',
  rowsPerPage: 5,
  showHeader: true,
  styles: ColumnStyles.DEFAULT_CONFIG, // TODO: rename styles option
  columns: [],
  scroll: false,
  scrollHeight: 'default',
  fontSize: '100%',
  sort: {
    col: 0,
    desc: true
  },
  colorder: [],
  // TODO: group with CSSStyles
  datatableTheme: 'basic_theme',
  rowNumbersEnabled: false,
  infoEnabled: true,
  searchEnabled: true,
  showCellBorders: false,
  showRowBorders: true,
  hoverEnabled: true,
  orderColumnEnabled: true,
  compactRowsEnabled: false,
  stripedRowsEnabled: true,
  lengthChangeEnabled: true,
  datatablePagingType: 'simple_numbers',
  pagingTypes: [
    {
      text: 'Page number buttons only',
      value: 'numbers',
    },
    {
      text: "'Previous' and 'Next' buttons only",
      value: 'simple'
    },
    {
      text: "'Previous' and 'Next' buttons, plus page numbers",
      value: 'simple_numbers'
    },
    {
      text: "'First', 'Previous', 'Next' and 'Last' buttons",
      value: 'full'
    },
    {
      text: "'First', 'Previous', 'Next' and 'Last' buttons, plus page numbers",
      value: 'full_numbers'
    },
    {
      text: "'First' and 'Last' buttons, plus page numbers",
      value: 'first_last_numbers'
    }
  ],
  themes: [
    {
      value: 'basic_theme',
      text: 'Basic',
      disabled: false,
    },
    {
      value: 'bootstrap_theme',
      text: 'Bootstrap',
      disabled: true,
    },
    {
      value: 'foundation_theme',
      text: 'Foundation',
      disabled: true,
    },
    {
      value: 'themeroller_theme',
      text: 'ThemeRoller',
      disabled: true,
    }
  ]

};

export class DatatablePanelCtrl extends MetricsPanelCtrl {

  constructor(
    $scope, $injector, $http, $location, $rootScope,
    uiSegmentSrv, annotationsSrv
  ) {


    super($scope, $injector);

    this.pageIndex = 0;
    this.table = null;
    this.dataRaw = [];
    this.transformers = Transformers.transformers;
    this.annotationsSrv = annotationsSrv;
    this.uiSegmentSrv = uiSegmentSrv;
    this.editMode = false;
    // editor

    this.addColumnSegment = uiSegmentSrv.newPlusButton();
    this.fontSizes = [
      '80%', '90%', '100%', '110%', '120%', '130%',
      '150%', '160%', '180%', '200%', '220%', '250%'
    ];
    // TODO: move to columnStyles
    this.colorModes = [
      {
        text: 'Disabled',
        value: null
      },
      {
        text: 'Value',
        value: 'value'
      },
      {
        text: 'Cell',
        value: 'cell'
      },
      {
        text: 'Row',
        value: 'row'
      },
      {
        text: 'Row Column',
        value: 'rowcolumn'
      },
    ];
    this.columnTypes = [
      {
        text: 'Number',
        value: 'number'
      },
      {
        text: 'String',
        value: 'string'
      },
      {
        text: 'Date',
        value: 'date'
      },
      {
        text: 'Custom',
        value: 'custom'
      },
      {
        text: 'Hidden',
        value: 'hidden'
      }
    ];
    this.unitFormats = kbn.getUnitFormats();
    this.dateFormats = [
      {
        text: 'YYYY-MM-DD HH:mm:ss',
        value: 'YYYY-MM-DD HH:mm:ss'
      },
      {
        text: 'MM/DD/YY h:mm:ss a',
        value: 'MM/DD/YY h:mm:ss a'
      },
      {
        text: 'MMMM D, YYYY LT',
        value: 'MMMM D, YYYY LT'
      },
    ];
    // this is used from bs-typeahead and needs to be instance bound
    this.getColumnNames = () => {
      if (!this.table) {
        return [];
      }
      return _.map(this.table.columns, col => col.text);
    };

    if (this.panel.styles === undefined) {
      this.panel.styles = this.panel.columns;
      this.panel.columns = this.panel.fields;
      delete this.panel.columns;
      delete this.panel.fields;
    }

    _.defaults(this.panel, panelDefaults);

    CSSStylesManager.resolveTheme(this.panel.datatableTheme, this.panelPath);
    this.dataLoaded = true;
    this.http = $http;
    this.editor = new Editor(this);

    this.panel.columnsStylesManager = new ColumnStyles.ColumnsStylesManager(
      this.panel.styles
    );
    this.events.on('data-received', this.onDataReceived.bind(this));
    this.events.on('data-error', this.onDataError.bind(this));
    this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
    this.events.on('init-edit-mode', this.editor.initEditMode.bind(this.editor));
    this.events.on('init-panel-actions', this.onInitPanelActions.bind(this));

  }

  onInitPanelActions(actions) {
    actions.push({
      text: 'Export CSV',
      click: 'ctrl.exportCsv()'
    });
  }

  changeView(fullscreen, edit) {
    this.editMode = edit;
    this.editor.changeState(fullscreen, edit);
    MetricsPanelCtrl.prototype.changeView.call(this, fullscreen, edit);
  }

  get panelPath() {
    var panels = grafanaBootData.settings.panels;
    var thisPanel = panels[this.pluginId];
    // the system loader preprends publib to the url,
    // add a .. to go back one level
    var thisPanelPath = '../' + thisPanel.baseUrl + '/';
    return thisPanelPath;
  }

  issueQueries(datasource) {
    this.pageIndex = 0;
    if (this.panel.transform === 'annotations') {
      this.setTimeQueryStart();
      return this.annotationsSrv.getAnnotations({
          dashboard: this.dashboard,
          panel: this.panel,
          range: this.range
        })
        .then(annotations => {
          return {
            data: annotations
          };
        });
    }
    return super.issueQueries(datasource);
  }

  onDataError(err) {
    this.dataRaw = [];
    this.render();
  }

  onDataReceived(dataList) {
    this.dataRaw = dataList;
    this.pageIndex = 0;

    // automatically correct transform mode based on data
    // TODO: use switch
    if (this.dataRaw && this.dataRaw.length) {
      if (this.dataRaw[0].type === 'table') {
        this.panel.transform = 'table';
      } else {
        if (this.dataRaw[0].type === 'docs') {
          this.panel.transform = 'json';
        } else {
          if (
            this.panel.transform === 'table' ||
            this.panel.transform === 'json'
          ) {
            this.panel.transform = 'timeseries_to_rows';
          }
        }
      }
    }
    this.render();
  }

  render() {
    this.table = Transformers.transformDataToTable(this.dataRaw, this.panel);
    this.table.sort(this.panel.sort);
    return super.render(this.table);
  }

  getPanelHeight() {
    // panel can have a fixed height via options
    var tmpPanelHeight = this.$scope.ctrl.panel.height;
    // if that is blank, try to get it from our row
    if (tmpPanelHeight === undefined) {
      // get from the row instead
      tmpPanelHeight = this.row.height;
      // default to 250px if that was undefined also
      if (tmpPanelHeight === undefined) {
        tmpPanelHeight = 250;
      }
    } else {
      // convert to numeric value
      tmpPanelHeight = tmpPanelHeight.replace("px","");
    }
    var actualHeight = parseInt(tmpPanelHeight);
    // grafana minimum height for a panel is 250px
    if (actualHeight < 250) {
      actualHeight = 250;
    }
    return actualHeight;
  }

  exportCsv() {
    var renderer = new DatatableRenderer(
      false, this.panel, this.table,
      this.dashboard.isTimezoneUtc(), this.$sanitize,
      this.colorder
    );
    FileExport.exportTableDataToCsv(renderer.renderValues());
  }

  link(scope, elem, attrs, ctrl) {
    var data;
    var panel = ctrl.panel;
    var formatters = [];
    var _this = this;

    function renderPanel() {
      _this.renderer = new DatatableRenderer(
        _this.editMode, panel, ctrl.table,
        ctrl.dashboard.isTimezoneUtc(), ctrl.$sanitize,
        _this.panel.colorder
      );
      _this.renderer.render();
      _this.dataLoaded = true;
    }

    ctrl.panel.panelHeight = this.getPanelHeight();
    ctrl.events.on('render', function(renderData) {
      data = renderData || data;
      if (data) {
        renderPanel();
      }
      ctrl.renderingCompleted();
    });
  }

  // editor methods
  //
  // cell and row borders cannot both be set at the same time
  showCellBordersChanged() {
    if (this.panel.showCellBorders) {
      this.panel.showRowBorders = false;
    }
    this.render();
  }

  themeChanged() {
    //console.log(this.panel.datatableTheme);
    this.render();
  }

  transformChanged() {
    this.panel.columns = [];
    this.render();
  }

  removeColumn(column) {
    this.panel.columns = _.without(this.panel.columns, column);
    this.render();
  }

  getColumnOptions() {
    if (!this.dataRaw) {
      return this.$q.when([]);
    }
    var columns = this.transformers[this.panel.transform]
      .getColumns(this.dataRaw);
    var segments = _.map(columns, (c) => this.uiSegmentSrv.newSegment({
      value: c.text
    }));
    return this.$q.when(segments);
  }

  addColumn() {
    var columns = transformers[this.panel.transform].getColumns(this.dataRaw);
    var column = _.find(columns, {
      text: this.addColumnSegment.value
    });

    if (column) {
      this.panel.columns.push(column);
      this.render();
    }

    var plusButton = this.uiSegmentSrv.newPlusButton();
    this.addColumnSegment.html = plusButton.html;
    this.addColumnSegment.value = plusButton.value;
  }

  setUnitFormat(column, subItem) {
    column.unit = subItem.value;
    this.render();
  }

  // TODO: rm render and watch vars
  invertColorOrder(index) {
    this.panel.columnsStylesManager.invertColorOrder(index);
    this.render();
  }

}
DatatablePanelCtrl.templateUrl = 'partials/template.html';
