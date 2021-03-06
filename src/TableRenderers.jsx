/* eslint-disable no-inline-comments */
import React from 'react';
import PropTypes from 'prop-types';
import {PivotData} from './Utilities';

// helper function for setting row/col-span in pivotTableRenderer
const spanSize = function(arr, i, j) {
  let x;
  if (i !== 0) {
    let asc, end;
    let noDraw = true;
    for (
      x = 0, end = j, asc = end >= 0;
      asc ? x <= end : x >= end;
      asc ? x++ : x--
    ) {
      if (arr[i - 1][x] !== arr[i][x]) {
        noDraw = false;
      }
    }
    if (noDraw) {
      return -1;
    }
  }
  let len = 0;
  while (i + len < arr.length) {
    let asc1, end1;
    let stop = false;
    for (
      x = 0, end1 = j, asc1 = end1 >= 0;
      asc1 ? x <= end1 : x >= end1;
      asc1 ? x++ : x--
    ) {
      if (arr[i][x] !== arr[i + len][x]) {
        stop = true;
      }
    }
    if (stop) {
      break;
    }
    len++;
  }
  return len;
};

function redColorScaleGenerator(values) {
  const min = Math.min.apply(Math, values);
  const max = Math.max.apply(Math, values);
  return x => {
    // eslint-disable-next-line no-magic-numbers
    const nonRed = 255 - Math.round((255 * (x - min)) / (max - min));
    return {backgroundColor: `rgb(255,${nonRed},${nonRed})`};
  };
}

function makeRenderer(opts = {}) {
  class TableRenderer extends React.PureComponent {
    render() {
      const pivotData = new PivotData(this.props);
      const colAttrs = pivotData.props.cols;
      const rowAttrs = pivotData.props.rows;
      const metricAttr = pivotData.props.metrics;
      const metricAggAttr = pivotData.props.mettricsAggregators;
      const rowKeys = pivotData.getRowKeys();
      const colKeys = pivotData.getColKeys();

      let valueCellColors = () => {};
      let rowTotalColors = () => {};
      let colTotalColors = () => {};

      if (opts.heatmapMode) {
        const colorScaleGenerator = this.props.tableColorScaleGenerator;
        const rowTotalValues = colKeys.map(x =>
          pivotData.getAggregator([], x, null).value()
        );
        rowTotalColors = colorScaleGenerator(rowTotalValues);
        const colTotalValues = rowKeys.map(x =>
          pivotData.getAggregator(x, [], null).value()
        );
        colTotalColors = colorScaleGenerator(colTotalValues);

        if (opts.heatmapMode === 'full') {
          const allValues = [];
          rowKeys.map(r =>
            colKeys.map(c =>
              allValues.push(pivotData.getAggregator(r, c, null).value())
            )
          );
          const colorScale = colorScaleGenerator(allValues);
          valueCellColors = (r, c, v) => colorScale(v);
        } else if (opts.heatmapMode === 'row') {
          const rowColorScales = {};
          rowKeys.map(r => {
            const rowValues = colKeys.map(x =>
              pivotData.getAggregator(r, x, null).value()
            );
            rowColorScales[r] = colorScaleGenerator(rowValues);
          });
          valueCellColors = (r, c, v) => rowColorScales[r](v);
        } else if (opts.heatmapMode === 'col') {
          const colColorScales = {};
          colKeys.map(c => {
            const colValues = rowKeys.map(x =>
              pivotData.getAggregator(x, c, null).value()
            );
            colColorScales[c] = colorScaleGenerator(colValues);
          });
          valueCellColors = (r, c, v) => colColorScales[c](v);
        }
      }

      const getClickHandler =
        this.props.tableOptions && this.props.tableOptions.clickCallback
          ? (value, rowValues, colValues) => {
              const filters = {};
              for (const i of Object.keys(colAttrs || {})) {
                const attr = colAttrs[i];
                if (colValues[i] !== null) {
                  filters[attr] = colValues[i];
                }
              }
              for (const i of Object.keys(rowAttrs || {})) {
                const attr = rowAttrs[i];
                if (rowValues[i] !== null) {
                  filters[attr] = rowValues[i];
                }
              }
              return e =>
                this.props.tableOptions.clickCallback(
                  e,
                  value,
                  filters,
                  pivotData
                );
            }
          : null;

      return (
        <table className="pvtTable">
          <thead>
            {colAttrs.map(function(c, j) {
              return (
                <tr key={`colAttr${j}`}>
                  {j === 0 && rowAttrs.length !== 0 && (
                    <th colSpan={rowAttrs.length} rowSpan={colAttrs.length} />
                  )}
                  <th className="pvtAxisLabel">{c}</th>
                  {colKeys.map(function(colKey, i) {
                    const x = metricAttr.length;
                    if (x === -1) {
                      return null;
                    }
                    return (
                      <th
                        className="pvtColLabel"
                        key={`colKey${i}`}
                        colSpan={x}
                        rowSpan={
                          j === colAttrs.length - 1 && rowAttrs.length !== 0
                            ? 1
                            : 1
                        }
                      >
                        {colKey[j]}
                      </th>
                    );
                  })}
                  {j === 0 &&
                    pivotData.metricsList.map((m, i) => {
                      return (
                        <th
                          key={`${m.name}_${i}`}
                          className="pvtTotalLabel"
                          rowSpan={
                            colAttrs.length + (rowAttrs.length === 0 ? 0 : 1)
                          }
                        >
                          {`Total ${m.name} ${m.agg}`}
                        </th>
                      );
                    })}
                </tr>
              );
            })}

            {rowAttrs.length !== 0 && (
              <tr>
                {rowAttrs.map(function(r, i) {
                  return (
                    <th className="pvtAxisLabel" key={`rowAttr${i}`}>
                      {r}
                    </th>
                  );
                })}
                <th></th>
                {colKeys.map(function(colKey) {
                  return pivotData.metricsList.map(metric => (
                    <th
                      key={`${metric.name}_${metric.agg}_${colKey}`}
                    >{`${metric.name} ${metric.agg}`}</th>
                  ));
                })}
              </tr>
            )}
          </thead>

          <tbody>
            {/* Build row key cells*/
            rowKeys.map(function(rowKey, i) {
              return (
                <tr key={`rowKeyRow${i}`}>
                  {rowKey.map(function(txt, j) {
                    const x = spanSize(rowKeys, i, j);
                    if (x === -1) {
                      return null;
                    }
                    return (
                      <th
                        key={`rowKeyLabel${i}-${j}`}
                        className="pvtRowLabel"
                        rowSpan={x}
                        colSpan={
                          j === rowAttrs.length - 1 && colAttrs.length !== 0
                            ? 2
                            : 1
                        }
                      >
                        {txt}
                      </th>
                    );
                  })}

                  {/* Build row value cells for each aggregator*/
                  colKeys.map(function(colKey, j) {
                    return pivotData.metricsList.map((metric, w) => {
                      const aggregator = pivotData.getAggregator(
                        rowKey,
                        colKey,
                        metric.name
                      );
                      return (
                        <td
                          className="pvtVal"
                          key={`pvtVal${i}-${j}-${metric.name}-${w}-${metric.agg}`}
                          onClick={
                            getClickHandler &&
                            getClickHandler(aggregator.value(), rowKey, colKey)
                          }
                          style={valueCellColors(
                            rowKey,
                            colKey,
                            aggregator.value()
                          )}
                        >
                          {aggregator.format(aggregator.value())}
                        </td>
                      );
                    });
                  })}

                  {/* Build row rotals cells for each aggregator*/
                  pivotData.metricsList.map((metric, w) => {
                    const totalAggregator = pivotData.getAggregator(
                      rowKey,
                      [],
                      metric.name
                    );
                    return (
                      <td
                        className="pvtTotal"
                        key={`${metric.name}_${w}`}
                        onClick={
                          getClickHandler &&
                          getClickHandler(totalAggregator.value(), rowKey, [
                            null,
                          ])
                        }
                        style={colTotalColors(totalAggregator.value())}
                      >
                        {totalAggregator.format(totalAggregator.value())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            <tr>
              <th
                className="pvtTotalLabel"
                colSpan={rowAttrs.length + (colAttrs.length === 0 ? 0 : 1)}
              >
                Totals
              </th>

              {colKeys.map(function(colKey, i) {
                return pivotData.metricsList.map((metric, w) => {
                  const totalAggregator = pivotData.getAggregator(
                    [],
                    colKey,
                    metric.name
                  );
                  return (
                    <td
                      className="pvtTotal"
                      key={`total${i}_${metric.name}_${w}`}
                      onClick={
                        getClickHandler &&
                        getClickHandler(totalAggregator.value(), [null], colKey)
                      }
                      style={rowTotalColors(totalAggregator.value())}
                    >
                      {totalAggregator.format(totalAggregator.value())}
                    </td>
                  );
                });
              })}

              {pivotData.metricsList.map((metric, w) => {
                const grandTotalAggregator = pivotData.getAggregator(
                  [],
                  [],
                  metric.name
                );
                return (
                  <td
                    key={`grandTotal_${metric.name}_${w}`}
                    onClick={
                      getClickHandler &&
                      getClickHandler(
                        grandTotalAggregator.value(),
                        [null],
                        [null]
                      )
                    }
                    className="pvtGrandTotal"
                  >
                    {grandTotalAggregator.format(grandTotalAggregator.value())}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      );
    }
  }

  TableRenderer.defaultProps = PivotData.defaultProps;
  TableRenderer.propTypes = PivotData.propTypes;
  TableRenderer.defaultProps.tableColorScaleGenerator = redColorScaleGenerator;
  TableRenderer.defaultProps.tableOptions = {};
  TableRenderer.propTypes.tableColorScaleGenerator = PropTypes.func;
  TableRenderer.propTypes.tableOptions = PropTypes.object;
  return TableRenderer;
}

class TSVExportRenderer extends React.PureComponent {
  render() {
    const pivotData = new PivotData(this.props);
    const rowKeys = pivotData.getRowKeys();
    const colKeys = pivotData.getColKeys();
    if (rowKeys.length === 0) {
      rowKeys.push([]);
    }
    if (colKeys.length === 0) {
      colKeys.push([]);
    }

    const headerRow = pivotData.props.rows.map(r => r);
    if (colKeys.length === 1 && colKeys[0].length === 0) {
      headerRow.push(this.props.aggregatorName);
    } else {
      colKeys.map(c => headerRow.push(c.join('-')));
    }

    const result = rowKeys.map(r => {
      const row = r.map(x => x);
      colKeys.map(c => {
        const v = pivotData.getAggregator(r, c, null).value();
        row.push(v ? v : '');
      });
      return row;
    });

    result.unshift(headerRow);

    return (
      <textarea
        value={result.map(r => r.join('\t')).join('\n')}
        style={{width: window.innerWidth / 2, height: window.innerHeight / 2}}
        readOnly={true}
      />
    );
  }
}

TSVExportRenderer.defaultProps = PivotData.defaultProps;
TSVExportRenderer.propTypes = PivotData.propTypes;

export default {
  Table: makeRenderer(),
  'Table Heatmap': makeRenderer({heatmapMode: 'full'}),
  'Table Col Heatmap': makeRenderer({heatmapMode: 'col'}),
  'Table Row Heatmap': makeRenderer({heatmapMode: 'row'}),
  'Exportable TSV': TSVExportRenderer,
};
