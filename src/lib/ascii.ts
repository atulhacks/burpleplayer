export const LCD_ASCII_ROWS = 6;
const LCD_ASCII_COLUMNS = 20;
const DENSITY = " .:-=+*#%@";

export const PAUSED_LCD_ASCII = [
  "  .----.    .----.   ",
  "  | .. |    | .. |   ",
  "  '----'    '----'   ",
  "                    ",
  "      P A U S E     ",
  "     ==========     ",
];

export function spectrumAsciiRows(
  bands: readonly number[],
  frame: number,
): string[] {
  const rows: string[] = [];
  for (let row = 0; row < LCD_ASCII_ROWS; row += 1) {
    let line = "";
    for (let column = 0; column < LCD_ASCII_COLUMNS; column += 1) {
      const band =
        (bands[Math.floor((column * bands.length) / LCD_ASCII_COLUMNS)] ?? 0) /
        255;
      const ripple = Math.sin(column * 0.72 + frame * 0.18) * 0.06;
      const height = Math.max(0, Math.min(1, band + ripple)) * LCD_ASCII_ROWS;
      const cell = height - (LCD_ASCII_ROWS - row - 1);
      const density = Math.max(
        0,
        Math.min(DENSITY.length - 1, Math.round(cell * 4)),
      );
      line += DENSITY[density];
    }
    rows.push(line);
  }
  return rows;
}

export const EMPTY_LIBRARY_ART = [
  "       .--.      .--.       ",
  "    .-(    )--(    )-.    ",
  "   (     .-~~-.     )     ",
  "    '-( (  ::  ) )-'      ",
  "       '-.____.-'          ",
  "      [  +  o  o ]        ",
  "       '--------'         ",
].join("\n");

const SCAN_FRAMES = [
  "    .-~~-.     \n .-(  *   )-.   \n(    .  .   )   \n '-.______.-'    \n [>.......]     ",
  "    .-~~-.     \n .-(   *  )-.   \n(    .  .   )   \n '-.______.-'    \n [==>.....]     ",
  "    .-~~-.     \n .-(    * )-.   \n(    .  .   )   \n '-.______.-'    \n [====>...]     ",
  "    .-~~-.     \n .-(     *)-.   \n(    .  .   )   \n '-.______.-'    \n [=======>]     ",
];

export function scanAsciiFrame(frame: number): string {
  return SCAN_FRAMES[
    ((Math.floor(frame) % SCAN_FRAMES.length) + SCAN_FRAMES.length) %
      SCAN_FRAMES.length
  ];
}
