import { buildBlanketConfirm, gyAffected } from "../src/lib/blanketConfirm.js";

let fails = 0;
const ok = (name, cond, extra = "") => {
  if (!cond) { fails++; console.log(`FAIL  ${name}${extra ? "  " + extra : ""}`); }
  else console.log(`ok    ${name}`);
};

// ── fixture: 16 grades, 6 of them GY with natural pairs, 1 GY orphan ──
const rates = [];
[16, 18, 20, 22, 24, 28, 30, 35].forEach((bf, i) => {
  rates.push({ code: String(bf), desc: `${bf} BF Kraft`, price: 30 + i, disc: 1, interest: 1.5 });
});
[16, 18, 20, 22, 24, 28].forEach((bf) => {
  rates.push({ code: `${bf}GY`, desc: `${bf} GY`, price: 0, disc: 1, interest: 1.5 });
});
rates.push({ code: "99GY", desc: "orphan GY", price: 0, disc: 1, interest: 1.5 }); // no natural pair
rates.push({ code: "40", desc: "40 BF", price: 44, disc: 2, interest: 1.75 });

console.log("── gyAffected: the count the confirm and the updater share ──");
const hits = gyAffected(rates, 1.5, 0.5);
ok("skips the GY grade with no natural pair", hits.length === 6, `got ${hits.length}`);
ok("orphan 99GY absent", !hits.some((h) => h.code === "99GY"));
ok("band premium low applied to 16GY", hits.find((h) => h.code === "16GY").to === +(30 + 1.5).toFixed(2));
ok("band premium high applied to 28GY", hits.find((h) => h.code === "28GY").to === +(35 + 0.5).toFixed(2));
ok("no natural grades in the affected set", hits.every((h) => h.code.endsWith("GY")));

console.log("\n── EDGE: affected = 0 ──");
const zero = buildBlanketConfirm({ kind: "recalc", label: "GY prices", affected: 0, total: 16 });
ok("not actionable", zero.actionable === false);
ok("says 0 of 16 grades", /0 of 16 grades/.test(zero.text), zero.text);
ok("no OK/Cancel offered", !/Cancel/.test(zero.text));

console.log("\n── EDGE: affected = 1 (pluralisation) ──");
const one = buildBlanketConfirm({ kind: "set", label: "Discount", valueText: "₹2.00/kg",
  affected: 1, total: 16, currentValues: ["16 BF Kraft ₹1.00"] });
ok("reads '1 of 16 grades'", /1 of 16 grades/.test(one.text), one.text.split("\n")[0]);
ok("OK line says apply to 1", /OK = apply to 1 ·/.test(one.text));
const solo = buildBlanketConfirm({ kind: "set", label: "Discount", valueText: "₹2.00/kg",
  affected: 1, total: 1, currentValues: ["16 BF Kraft ₹1.00"] });
ok("total=1 says 'ALL 1 grade' singular", /ALL 1 grade\?/.test(solo.text), solo.text.split("\n")[0]);

console.log("\n── EDGE: affected = total ──");
const all = buildBlanketConfirm({ kind: "set", label: "Discount", valueText: "₹2.00/kg",
  affected: 16, total: 16, currentValues: rates.slice(0, 16).map((r) => ({text:`${r.desc} ₹${r.disc.toFixed(2)}`,value:r.disc})) });
ok("says ALL 16 grades, not '16 of 16'", /ALL 16 grades\?/.test(all.text) && !/16 of 16/.test(all.text));
ok("states the invalidation", /cleared and must be recalculated/.test(all.text));
ok("Cancel = change nothing", /Cancel = change nothing/.test(all.text));

console.log("\n── EDGE: truncation shows how many of how many ──");
ok("truncated list carries '(3 of 16 shown)'", /\(3 of 16 shown\)/.test(all.text), all.text);
const short = buildBlanketConfirm({ kind: "set", label: "Discount", valueText: "₹2.00/kg",
  affected: 2, total: 2, currentValues: ["16 BF ₹1.00", "18 BF ₹1.00"] });
ok("no '(n of m shown)' when nothing is hidden", !/shown\)/.test(short.text));

console.log("\n── the three live strings, as the Maker will read them ──");
const disc = buildBlanketConfirm({ kind: "set", label: "Discount", valueText: "₹2.00/kg",
  affected: rates.length, total: rates.length,
  currentValues: rates.map((r) => ({text:`${r.desc} ₹${(+r.disc).toFixed(2)}`,value:+r.disc})) });
const cred = buildBlanketConfirm({ kind: "set", label: "Credit%", valueText: "1.75%",
  affected: rates.length, total: rates.length,
  currentValues: rates.map((r) => ({text:`${r.desc} ${(+r.interest).toFixed(2)}%`,value:+r.interest})) });
const gy = buildBlanketConfirm({ kind: "recalc", label: "GY prices",
  affected: hits.length, total: rates.length, affectedCodes: hits.map((h) => h.code),
  detail: "Each GY grade's price is overwritten with its natural grade's price plus the band premium — ₹1.5 for 16–24BF, ₹0.5 for 28–35BF." });
[["DISC", disc], ["CREDIT", cred], ["APPLY GY", gy]].forEach(([n2, c]) => {
  console.log(`\n[${n2}]\n${c.text}`);
});
ok("\nGY names the count, never 'all'", /6 of 16 grades/.test(gy.text) && !/ALL/.test(gy.text));

console.log("\n── EDGE: 'vary' must not be claimed when values are identical ──");
const same = buildBlanketConfirm({ kind: "set", label: "Discount", valueText: "₹2.00/kg",
  affected: 3, total: 3, currentValues: [{text:"A ₹1.00",value:1},{text:"B ₹1.00",value:1},{text:"C ₹1.00",value:1}] });
ok("identical values say 'Current values:' not 'vary'",
   /Current values:/.test(same.text) && !/vary/.test(same.text), same.text);
const differ = buildBlanketConfirm({ kind: "set", label: "Discount", valueText: "₹2.00/kg",
  affected: 3, total: 3, currentValues: [{text:"A ₹1.00",value:1},{text:"B ₹2.00",value:2},{text:"C ₹1.00",value:1}] });
ok("differing values do say 'Current values vary'", /Current values vary/.test(differ.text));

console.log("\n── EDGE: a code list long enough to truncate ──");
const many = buildBlanketConfirm({ kind: "recalc", label: "GY prices", affected: 12, total: 30,
  affectedCodes: ["16GY","18GY","20GY","22GY","24GY","28GY","30GY","32GY","35GY","38GY","40GY","42GY"] });
ok("codes truncate at 8, carrying '(8 of 12 shown)'", /\(8 of 12 shown\)/.test(many.text), many.text);

console.log(fails === 0 ? "\nall checks pass" : `\n${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
