import { useState } from "react";
import { METRICS, DEFAULT_SETTINGS } from "../utils/metrics";
import { DEFAULT_RULES } from "../utils/rules";

// Thresholds are stored in raw units; show money in billions and fractions as %.
const INPUT_SCALE = { money: 1e9, pct: 0.01 };
const INPUT_UNIT = { money: "B", pct: "%" };

const toInput = (rule) => {
  const scale = INPUT_SCALE[METRICS[rule.metric].format] ?? 1;
  return Number((rule.threshold / scale).toPrecision(6));
};

export default function RulesView({ rules, setRules, settings, setSettings }) {
  // Bumped on reset so the uncontrolled threshold inputs pick up new values.
  const [version, setVersion] = useState(0);
  const update = (id, patch) => setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const setThreshold = (rule, raw) => {
    const n = Number(raw);
    if (raw === "" || Number.isNaN(n)) return;
    const scale = INPUT_SCALE[METRICS[rule.metric].format] ?? 1;
    update(rule.id, { threshold: n * scale });
  };

  const addRule = () =>
    setRules((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, label: "My rule", metric: "pe", op: "<=", threshold: 20, enabled: true, why: "" },
    ]);

  const removeRule = (id) => setRules((prev) => prev.filter((r) => r.id !== id));

  return (
    <div className="page2">
      <h2 className="h2">My Rules</h2>
      <p className="page-sub">
        The rules every company is scored against. Defaults are Benjamin Graham&apos;s tests for the defensive
        investor; change thresholds, switch rules on or off, or add your own. Saved in this browser.
      </p>

      <div className="table-wrap">
        <table className="table rules-table">
          <thead>
            <tr>
              <th>On</th>
              <th>Rule</th>
              <th>Metric</th>
              <th>Condition</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const format = METRICS[rule.metric].format;
              return (
                <tr key={rule.id} className={rule.enabled ? "" : "rule-off"}>
                  <td>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => update(rule.id, { enabled: e.target.checked })}
                      aria-label={`Use rule ${rule.label}`}
                    />
                  </td>
                  <td>
                    <input
                      className="form-input rule-name"
                      value={rule.label}
                      onChange={(e) => update(rule.id, { label: e.target.value })}
                    />
                    {rule.why && <div className="cell-sub">{rule.why}</div>}
                  </td>
                  <td>
                    <select
                      className="form-input"
                      value={rule.metric}
                      onChange={(e) => update(rule.id, { metric: e.target.value })}
                    >
                      {Object.entries(METRICS).map(([key, m]) => (
                        <option key={key} value={key}>{m.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="rule-condition">
                    <select
                      className="form-input"
                      value={rule.op}
                      onChange={(e) => update(rule.id, { op: e.target.value })}
                      aria-label="Comparison"
                    >
                      <option value=">=">at least</option>
                      <option value="<=">at most</option>
                    </select>
                    <input
                      className="form-input threshold-input"
                      type="number"
                      step="any"
                      key={`${rule.id}-${rule.metric}-${version}`}
                      defaultValue={toInput(rule)}
                      onChange={(e) => setThreshold(rule, e.target.value)}
                      aria-label="Threshold"
                    />
                    <span className="cell-sub">{INPUT_UNIT[format] ?? ""}</span>
                  </td>
                  <td>
                    <button className="sort-btn" onClick={() => removeRule(rule.id)} aria-label={`Delete ${rule.label}`}>
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="controls rules-actions">
        <button className="sort-btn sort-btn-active" onClick={addRule}>+ Add rule</button>
        <button className="sort-btn" onClick={() => {
            setRules(DEFAULT_RULES);
            setVersion((v) => v + 1);
          }}>Reset to Graham defaults</button>
      </div>

      <h3 className="section-title">Valuation settings</h3>
      <div className="controls">
        <label className="control-label" htmlFor="aaa-yield">AAA corporate bond yield (%)</label>
        <input
          id="aaa-yield"
          className="form-input threshold-input"
          type="number"
          step="0.1"
          min="0.5"
          value={settings.aaaYield}
          onChange={(e) => Number(e.target.value) > 0 && setSettings({ ...settings, aaaYield: Number(e.target.value) })}
        />
        <label className="control-label" htmlFor="max-growth">Growth cap (%)</label>
        <input
          id="max-growth"
          className="form-input threshold-input"
          type="number"
          step="1"
          min="0"
          value={settings.maxGrowth}
          onChange={(e) => e.target.value !== "" && setSettings({ ...settings, maxGrowth: Number(e.target.value) })}
        />
        <button className="sort-btn" onClick={() => setSettings(DEFAULT_SETTINGS)}>Reset</button>
      </div>
    </div>
  );
}
