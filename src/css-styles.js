import './css/panel.css!';

// this is needed for basic datatables.net theme
//import './libs/datatables.net-dt/css/jquery.dataTables.min.css!';

// See this for styling https://datatables.net/manual/styling/theme-creator

/*
Dark Theme Basic uses these values

table section border: #242222 rgb(36,34,34)
row/cell border: #141414 rgb(20,20,20)
row background: #1F1D1D  rgb(31,29,29)
row selected color:  #242222 rgb(36,34,34)
control text: #1FB2E5 rgb(31,178,229)
control text: white  (dataTables_paginate)
paging active button: #242222 rgb(36,34,34)
paging button hover: #111111 rgb(17,17,17)

with these modifications:
.dataTables_wrapper .dataTables_paginate .paginate_button {
  color: white
}
table.dataTable tfoot th {
  color: #1FB2E5;
  font-weight: bold; }


Light Theme Basic uses these values

table section border: #ECECEC rgb(236,236,236)
row/cell border: #FFFFFF rgb(255,255,255)
row background: #FBFBFB  rgb(251,251,251)
row selected color:  #ECECEC rgb(236,236,236)
control text: black
paging active button: #BEBEBE
paging button hover: #C0C0C0

with these modifications:
.dataTables_wrapper .dataTables_paginate .paginate_button.current,
.dataTables_wrapper .dataTables_paginate .paginate_button.current:hover {
  color: #1fb2e5 !important;
table.dataTable tfoot th {
  color: #1FB2E5;
  font-weight: bold; }
*/

// themes attempt to modify the entire page, this "contains" the styling to the table only
import './css/datatables-wrapper.css!';

const THEME_LIGHT_FILE = './css/datatable-light.css';
const THEME_DARK_FILE  = './css/datatable-dark.css';

export class CSSStylesManager {
  static resolveTheme(datatableTheme, panelPath) {
    if(datatableTheme === undefined) {
      throw new Error('datatableTheme path is undefined');
    }
    if(panelPath === undefined) {
      throw new Error('panel path is undefined');
    }

    System.config({
      paths: {
        "datatables.net": this.panelPath + "libs/datatables.net/js/jquery.dataTables.min",
        "datatables.net-bs" : this.panelPath + "libs/datatables.net-bs/js/dataTables.bootstrap.min",
        "datatables.net-jqui" : this.panelPath + "libs/datatables.net-jqui/js/dataTables.jqueryui.min",
        "datatables.net-zf" : this.panelPath + "libs/datatables.net-zf/js/dataTables.foundation.min",
      }
    });

    // basic datatables theme
    // alternative themes are disabled since they affect all datatable panels on same page currently
    switch (datatableTheme) {
      case 'basic_theme':
        System.import(panelPath + 'libs/datatables.net-dt/css/jquery.dataTables.min.css!');
        if (grafanaBootData.user.lightTheme) {
          System.import(panelPath + THEME_LIGHT_FILE + '!css');
        } else {
          System.import(panelPath + THEME_DARK_FILE + "!css");
        }
        break;
      case 'bootstrap_theme':
        System.import(panelPath + 'libs/datatables.net-bs/js/dataTables.bootstrap.min.js');
        System.import(panelPath + 'libs/bootstrap/dist/css/prefixed-bootstrap.min.css!');
        System.import(panelPath + 'libs/datatables.net-bs/css/dataTables.bootstrap.min.css!');
        if (!grafanaBootData.user.lightTheme) {
          System.import(panelPath + 'css/prefixed-bootstrap-slate.min.css!');
        }
        break;
      case 'foundation_theme':
        System.import(panelPath + 'libs/datatables.net-zf/js/dataTables.foundation.min.js');
        System.import(panelPath + 'libs/foundation/css/prefixed-foundation.min.css!');
        System.import(panelPath + 'libs/datatables.net-zf/css/dataTables.foundation.min.css!');
        break;
      case 'themeroller_theme':
        System.import(panelPath + 'libs/datatables.net-jqui/js/dataTables.jqueryui.min.js');
        System.import(panelPath + 'libs/datatables.net-jqui/css/dataTables.jqueryui.min.css!');
        System.import(panelPath + 'css/jquery-ui-smoothness.css!');
        break;
      default:
        System.import(panelPath + 'libs/datatables.net-dt/css/jquery.dataTables.min.css!');
        if (grafanaBootData.user.lightTheme) {
          System.import(panelPath + this.panel.themeOptions.light + '!css');
        } else {
          System.import(panelPath + this.panel.themeOptions.dark + "!css");
        }
        break;
    }
  }
}
