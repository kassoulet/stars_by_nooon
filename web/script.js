// Demo timeline. Each part starts once the previous one has ended AND music pos (order<<8|row) > start.
// `x` = named export of the module (default otherwise). Parts that wait on pos themselves have start 0.
export const SCRIPT = [
  { part: 'intro', start: 0 },
  { part: 'e1', start: 0 },
  { part: 'e2', start: 0 },
  { part: 'partb', start: 0x1700 },
  { part: 'partc', start: 0x2700 },
  { part: 'terrain', start: 0x3500 },
  { part: 'partd', start: 0 },
  { part: 'credits', x: 'picture57', start: 0x5500 },
  { part: 'partf', start: 0x5820 },
  { part: 'textg', x: 'textg1', start: 0x6100 },
  { part: 'parth', start: 0x6900 },
  { part: 'parti', start: 0x6c00 },
  { part: 'textg', x: 'textg2', start: 0 },
  { part: 'partj', start: 0x8700 },
  { part: 'credits', start: 0 },
];
