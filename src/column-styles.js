import kbn from 'app/core/utils/kbn';

function swap(xs, p, q) {
  var t = xs[p];
  xs[p] = xs[q];
  xs[q] = t;
  return xs;
}

const DEFAULT_RENDER_FUNCTION =
`function(data, type, full, meta) {
  return '<a href="'+data+'">Download</a>';
}
`;

const NEW_STYLE_DEFAULT = {
  unit: 'short',
  type: 'number',
  decimals: 2,
  colors: [
    "rgba(245, 54, 54, 0.9)",
    "rgba(237, 129, 40, 0.89)",
    "rgba(50, 172, 45, 0.97)"
  ],
  colorMode: null,
  pattern: '/.*/',
  thresholds: [],
  // default config for custom style
  renderFunction: DEFAULT_RENDER_FUNCTION
};

export const DEFAULT_CONFIG = [
  {
    type: 'date',
    pattern: 'Time',
    dateFormat: 'YYYY-MM-DD HH:mm:ss',
  },
  NEW_STYLE_DEFAULT
];

export class ColumnsStylesManager {
  constructor(columnStylesConfig) {
    this.styles = columnStylesConfig;
  }

  isHidden(columnName) {
    var style = this.findStyle(columnName);
    return style && style.type === 'hidden';
  }

  findStyle(columnName) {
    for (let i = 0; i < this.styles.length; i++) {
      let style = this.styles[i];
      var regex = kbn.stringToJsRegex(style.pattern);
      if (columnName.match(regex)) {
        return style;
      }
    }
    return undefined;
  }

  addColumnStyle() {
    this.styles.push(angular.copy(NEW_STYLE_DEFAULT));
  }

  removeColumnStyle(index) {
    this.styles.splice(index, 1);
  }

  moveUpColumnStyle(index) {
    swap(this.styles, index - 1, index);
  }

  moveDownColumnStyle(index) {
    swap(this.styles, index + 1, index);
  }

  invertColorOrder(index) {
    swap(this.styles[index].colors, 0, 2);
  }

}
