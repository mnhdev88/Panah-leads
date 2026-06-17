async function search() {
  const res = await fetch("https://api.apify.com/v2/store/actors?search=upwork");
  const data = await res.json();
  const top = data.data.items.slice(0, 3).map(a => a.name);
  console.log(top);
}
search();
