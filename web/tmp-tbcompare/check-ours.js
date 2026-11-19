const d = JSON.parse(fs.readFileSync('tmp-tbcompare/ours.json', 'utf8'));
console.log('type:', Array.isArray(d) ? 'array' : typeof d);
if (Array.isArray(d)) {
  console.log('length:', d.length);
  console.log('first 3:', JSON.stringify(d.slice(0,3), null, 2));
} else {
  console.log('keys:', Object.keys(d));
  console.log('first 3 entries:', JSON.stringify(Object.entries(d).slice(0,3), null, 2));
}
