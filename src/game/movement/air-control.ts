// Responsável por encapsular a força de controle no ar para manter salto responsivo sem perder consistência.
export function resolveAirControlMultiplier(isGrounded: boolean, configuredAirControl: number): number {
  if (isGrounded) {
    return 1;
  }

  return Math.max(0, Math.min(1, configuredAirControl));
}
