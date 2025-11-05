import React, { useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts'

type Inputs = {
  currency: string
  stores: number
  feePerStorePerYear: number
  annualRevenuePerStore: number
  grossMarginPct: number
  laborCostPctOfRevenue: number
  shrinkPctOfCOGS: number
  salesUpliftPct: number
  gmImprovementPP: number
  laborEfficiencyPct: number
  shrinkReductionPct: number
  complianceSavingsPerStore: number
  discountRate: number
  rampY1: number; rampY2: number; rampY3: number
}

const defaultInputs: Inputs = {
  currency: 'NOK',
  stores: 100,
  feePerStorePerYear: 600_000,
  annualRevenuePerStore: 12_000_000,
  grossMarginPct: 0.32,
  laborCostPctOfRevenue: 0.12,
  shrinkPctOfCOGS: 0.02,
  salesUpliftPct: 0.015,
  gmImprovementPP: 0.005,
  laborEfficiencyPct: 0.02,
  shrinkReductionPct: 0.20,
  complianceSavingsPerStore: 10_000,
  discountRate: 0.10,
  rampY1: 0.70, rampY2: 1.0, rampY3: 1.0,
}

const presets: Record<string, Partial<Inputs>> = {
  worst: { salesUpliftPct: 0.004, gmImprovementPP: 0.001, laborEfficiencyPct: 0.005, shrinkReductionPct: 0.05, complianceSavingsPerStore: 0 },
  base:  { salesUpliftPct: 0.015, gmImprovementPP: 0.005, laborEfficiencyPct: 0.02,  shrinkReductionPct: 0.20, complianceSavingsPerStore: 10_000 },
  best:  { salesUpliftPct: 0.03,  gmImprovementPP: 0.01,  laborEfficiencyPct: 0.04,  shrinkReductionPct: 0.35, complianceSavingsPerStore: 30_000 },
}

const fmt = (n:number, currency:string) => new Intl.NumberFormat('no-NO',{style:'currency',currency}).format(n)
const pct = (n:number) => `${(n*100).toFixed(1)}%`
const npv = (r:number, cfs:number[]) => cfs.reduce((a,c,i)=>a + c/Math.pow(1+r,i+1), 0)
function irr(cfs:number[]){ const same=cfs.every(c=>c>=0)||cfs.every(c=>c<=0); if(same) return NaN; let r=0.1; for(let k=0;k<100;k++){ let f=0,df=0; for(let t=1;t<=cfs.length;t++){ const c=cfs[t-1]; f+=c/Math.pow(1+r,t); df+=(-t*c)/Math.pow(1+r,t+1);} const rn=r - f/df; if(!isFinite(rn)||Math.abs(rn-r)<1e-7){r=rn;break;} r=rn;} return r; }
function base(inp:Inputs){ const revenue=inp.annualRevenuePerStore; const gp=revenue*inp.grossMarginPct; const cogs=revenue-gp; const labor=inp.laborCostPctOfRevenue*revenue; const shrink=inp.shrinkPctOfCOGS*cogs; return { revenue, gp, cogs, labor, shrink, op: gp - labor - shrink } }
function withOrb(inp:Inputs, scale:number){ const revenue=inp.annualRevenuePerStore*(1+inp.salesUpliftPct*scale); const gm=Math.min(0.99, Math.max(0, inp.grossMarginPct + inp.gmImprovementPP*scale)); const gp=revenue*gm; const cogs=revenue-gp; const labor=inp.laborCostPctOfRevenue*revenue*(1-inp.laborEfficiencyPct*scale); const shrink=inp.shrinkPctOfCOGS*cogs*(1-inp.shrinkReductionPct*scale); return { revenue, gp, cogs, labor, shrink, op: gp - labor - shrink } }

export default function App(){
  const [inp, setInp] = useState<Inputs>(defaultInputs)
  const [monthly, setMonthly] = useState(false)
  const [tab, setTab] = useState<'sim'|'assumptions'|'about'>('sim')

  const baseline = useMemo(()=>base(inp),[inp])
  const years = [{name:'År 1', scale: inp.rampY1},{name:'År 2', scale: inp.rampY2},{name:'År 3', scale: inp.rampY3}]

  const rows = years.map(y=>{ const w=withOrb(inp,y.scale); const comp=inp.complianceSavingsPerStore*y.scale; const fee=inp.feePerStorePerYear; const inc=(w.op - baseline.op)+comp-fee; return {year:y.name, scale:y.scale, ...w, baselineOp:baseline.op, compliance:comp, fee, incremental:inc}; })
  const cf = rows.map(r=>r.incremental)
  const storeNPV = npv(inp.discountRate, cf)
  const storeIRR = irr(cf)
  const fullInc = (withOrb(inp,1.0).op - baseline.op) + inp.complianceSavingsPerStore - inp.feePerStorePerYear
  const roi = inp.feePerStorePerYear!==0 ? fullInc / inp.feePerStorePerYear : NaN
  const payback = fullInc>0 ? inp.feePerStorePerYear/fullInc : NaN
  const chainNPV = storeNPV * inp.stores

  const factor = monthly ? 1/12 : 1
  const chartData = rows.map(r=>({ name:r.year, 'Inkrementell kontantstrøm': Math.round(r.incremental*factor) }))

  const scenarios = ['worst','base','best'] as const
  const scenarioRows = scenarios.map((key)=>{
    const s = { ...inp, ...presets[key] } as Inputs
    const b = base(s)
    const yrows = years.map(y=>{
      const w = withOrb(s,y.scale); const comp=s.complianceSavingsPerStore*y.scale; const fee=s.feePerStorePerYear
      return (w.op - b.op) + comp - fee
    })
    const fb = (withOrb(s,1.0).op - b.op) + s.complianceSavingsPerStore - s.feePerStorePerYear
    return { key, npv: npv(s.discountRate, yrows), irr: irr(yrows), roi: fb/s.feePerStorePerYear, payback: fb>0? s.feePerStorePerYear/fb: NaN }
  })

  const setNum = (k:keyof Inputs) => (e:React.ChangeEvent<HTMLInputElement>) => setInp(s=>({...s, [k]: Number(e.target.value)}))
  const setPct = (k:keyof Inputs) => (e:React.ChangeEvent<HTMLInputElement>) => setInp(s=>({...s, [k]: Number(e.target.value)/100}))

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="/orbital.svg" alt="orbital"/>
          <div>
            <div className="t">Orbital</div>
            <div className="legend">ROI Simulator</div>
          </div>
        </div>
        <div className="nav">
          <button className={tab==='sim'?'active':''} onClick={()=>setTab('sim')}>Simulator</button>
          <button className={tab==='assumptions'?'active':''} onClick={()=>setTab('assumptions')}>Assumptions</button>
          <button className={tab==='about'?'active':''} onClick={()=>setTab('about')}>About</button>
        </div>
        <div style={{marginTop:'auto'}} className="legend">
          © {new Date().getFullYear()} Orbital Technologies
        </div>
      </aside>

      <main className="main">
        {tab==='sim' && (
          <>
            <div className="header">
              <h1 className="h1">Chain ROI Overview</h1>
              <div className="row">
                <label className="row" style={{gap:8}}>
                  <span className="legend">Monthly view</span>
                  <input type="checkbox" checked={monthly} onChange={(e)=>setMonthly(e.target.checked)} />
                </label>
                <select className="select" value={inp.currency} onChange={(e)=>setInp(s=>({...s, currency:e.target.value}))}>
                  <option value="NOK">NOK</option><option value="SEK">SEK</option><option value="DKK">DKK</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                </select>
                <button className="btn" onClick={()=>downloadCSV(rows)}>Export CSV</button>
                <button className="btn primary" onClick={()=>setInp(defaultInputs)}>Reset</button>
              </div>
            </div>

            <div className="grid cols-3">
              <div className="card">
                <div className="kpi-label">ROI (full effekt)</div>
                <div className="kpi">{isFinite(roi)? pct(roi): '–'}</div>
              </div>
              <div className="card">
                <div className="kpi-label">Payback (år)</div>
                <div className="kpi">{isFinite(payback)? payback.toFixed(2): '–'}</div>
              </div>
              <div className="card">
                <div className="kpi-label">NPV – kjede (3 år){monthly? ' / mnd':''}</div>
                <div className="kpi">{fmt(chainNPV*(monthly?1/12:1), inp.currency)}</div>
              </div>
            </div>

            <div className="grid" style={{gridTemplateColumns:'1.3fr 1fr', marginTop:14}}>
              <div className="card">
                <h3 className="section-title">Incremental cash flow per store ({monthly? 'per måned':'per år'})</h3>
                <div style={{width:'100%', height:360}}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="name" stroke="#9aa8c7" />
                      <YAxis stroke="#9aa8c7" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Inkrementell kontantstrøm" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="footer">
                  <span className="legend">Discount rate {pct(inp.discountRate)}</span>
                  <span className="legend">Per store NPV: {fmt(storeNPV*(monthly?1/12:1), inp.currency)}</span>
                </div>
              </div>

              <div className="card">
                <h3 className="section-title">Key Inputs</h3>
                <div className="controls">
                  <div>
                    <label className="label">Butikker i kjeden</label>
                    <input className="input" type="number" value={inp.stores} onChange={setNum('stores')} />
                  </div>
                  <div>
                    <label className="label">Avgift / butikk / år ({inp.currency})</label>
                    <input className="input" type="number" value={inp.feePerStorePerYear} onChange={setNum('feePerStorePerYear')} />
                    <div className="legend">= {fmt(inp.feePerStorePerYear/12, inp.currency)} / mnd</div>
                  </div>
                  <div>
                    <label className="label">Omsetning / butikk / år</label>
                    <input className="input" type="number" value={inp.annualRevenuePerStore} onChange={setNum('annualRevenuePerStore')} />
                  </div>
                  <div>
                    <label className="label">Diskonteringsrente</label>
                    <input className="input" type="number" step="0.01" value={inp.discountRate} onChange={setNum('discountRate')} />
                  </div>
                  <div>
                    <label className="label">Bruttoavanse (%)</label>
                    <input className="input" type="range" min={0} max={100} step={0.1} value={inp.grossMarginPct*100} onChange={setPct('grossMarginPct')} />
                    <div className="legend">{(inp.grossMarginPct*100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <label className="label">Salg uplift (%)</label>
                    <input className="input" type="range" min={0} max={100} step={0.1} value={inp.salesUpliftPct*100} onChange={setPct('salesUpliftPct')} />
                    <div className="legend">{(inp.salesUpliftPct*100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <label className="label">Margin +pp</label>
                    <input className="input" type="range" min={0} max={100} step={0.1} value={inp.gmImprovementPP*100} onChange={setPct('gmImprovementPP')} />
                    <div className="legend">{(inp.gmImprovementPP*100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <label className="label">Arbeidskost-effektivisering (%)</label>
                    <input className="input" type="range" min={0} max={100} step={0.1} value={inp.laborEfficiencyPct*100} onChange={setPct('laborEfficiencyPct')} />
                    <div className="legend">{(inp.laborEfficiencyPct*100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <label className="label">Svinn-reduksjon (%)</label>
                    <input className="input" type="range" min={0} max={100} step={0.1} value={inp.shrinkReductionPct*100} onChange={setPct('shrinkReductionPct')} />
                    <div className="legend">{(inp.shrinkReductionPct*100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <label className="label">Compliance-besparelse / butikk / år</label>
                    <input className="input" type="number" value={inp.complianceSavingsPerStore} onChange={setNum('complianceSavingsPerStore')} />
                  </div>
                  <div>
                    <label className="label">Adopsjon år 1 (%)</label>
                    <input className="input" type="range" min={0} max={100} step={1} value={inp.rampY1*100} onChange={setPct('rampY1')} />
                    <div className="legend">{(inp.rampY1*100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <label className="label">Adopsjon år 2 (%)</label>
                    <input className="input" type="range" min={0} max={100} step={1} value={inp.rampY2*100} onChange={setPct('rampY2')} />
                    <div className="legend">{(inp.rampY2*100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <label className="label">Adopsjon år 3 (%)</label>
                    <input className="input" type="range" min={0} max={100} step={1} value={inp.rampY3*100} onChange={setPct('rampY3')} />
                    <div className="legend">{(inp.rampY3*100).toFixed(0)}%</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid" style={{gridTemplateColumns:'1fr 1fr 1fr', marginTop:14}}>
              {scenarioRows.map(s=>(
                <div className="card" key={s.key}>
                  <div className="legend" style={{textTransform:'capitalize'}}>{s.key}-case</div>
                  <table className="table">
                    <tbody>
                      <tr><td>ROI</td><td>{isFinite(s.roi)? pct(s.roi): '–'}</td></tr>
                      <tr><td>Payback (år)</td><td>{isFinite(s.payback)? s.payback.toFixed(2): '–'}</td></tr>
                      <tr><td>NPV (3 år) – per butikk</td><td>{fmt(s.npv, inp.currency)}</td></tr>
                      <tr><td>IRR (3 år)</td><td>{isFinite(s.irr)? pct(s.irr): '–'}</td></tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </>
        )}

        {tab==='assumptions' && (
          <div className="card">
            <h3 className="section-title">Assumptions & Model Notes</h3>
            <ul className="legend">
              <li>Avgift per butikk: {fmt(inp.feePerStorePerYear, inp.currency)} / år</li>
              <li>Bruttoavanse: {pct(inp.grossMarginPct)}</li>
              <li>Labor cost: {pct(inp.laborCostPctOfRevenue)} av omsetning</li>
              <li>Svinn (av COGS): {pct(inp.shrinkPctOfCOGS)}</li>
              <li>Discount rate: {pct(inp.discountRate)}</li>
              <li>Adopsjon (Y1/Y2/Y3): {pct(inp.rampY1)} / {pct(inp.rampY2)} / {pct(inp.rampY3)}</li>
            </ul>
          </div>
        )}

        {tab==='about' && (
          <div className="card">
            <h3 className="section-title">About Orbital</h3>
            <p className="legend">
              Orbital forener retail-systemer til et åpent, intelligent og interoperabelt nettverk.
              Simulatoren viser NPV/IRR/ROI for en kjede med {inp.stores} butikker gitt antatte effekter
              (salg, margin, arbeidskost og svinn) samt årlig plattformavgift.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

function downloadCSV(rows:any[]){
  const headers = ["Year","Scale","Revenue","GrossProfit","LaborCost","Shrink","OperatingProfit","BaselineOp","Compliance","Fee","IncrementalCF"]
  const lines = [headers.join(",")].concat(
    rows.map((r:any) => [r.year, r.scale, r.revenue, r.gp, r.labor, r.shrink, r.op, r.baselineOp, r.compliance, r.fee, r.incremental].join(","))
  )
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = "orbital_roi.csv"; a.click()
  URL.revokeObjectURL(url)
}
