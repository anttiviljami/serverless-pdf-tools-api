/**
 * Converts CMYK colour string of format 11,32,34,41 to 8-bit hex
 *
 * @export
 * @param {string} cmykString
 * @returns {number}
 */
export function cmykStringToHex(cmykString: string) {
  const components: number[] = cmykString
    .split(',')
    .map((component: string) => Math.round((Number(component) / 100) * 255));
  const hexcomponents = components.map((component: number) => `0${component.toString(16)}`.substr(-2));
  return parseInt(hexcomponents.join(''), 16);
}
