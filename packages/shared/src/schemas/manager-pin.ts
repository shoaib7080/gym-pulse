import { z } from 'zod';

export const TRIVIAL_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '2345', '3456', '4567', '5678', '6789', '0123',
  '4321', '5432', '6543', '7654', '8765', '9876', '3210',
  '12345', '123456', '1234567', '12345678',
  '00000', '11111', '22222', '33333', '44444', '55555', '66666', '77777', '88888', '99999',
  '000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999',
]);

/**
 * Validates whether a PIN string is trivially guessable (repeated digits or consecutive sequences)
 */
export function isTrivialPin(pin: string): boolean {
  if (TRIVIAL_PINS.has(pin)) {
    return true;
  }

  // All identical digits (e.g. "55555")
  const allSame = pin.split('').every((ch) => ch === pin[0]);
  if (allSame) {
    return true;
  }

  // Consecutive ascending digits (e.g. "23456")
  let isAsc = true;
  for (let i = 1; i < pin.length; i++) {
    if (pin.charCodeAt(i) !== pin.charCodeAt(i - 1) + 1) {
      isAsc = false;
      break;
    }
  }
  if (isAsc) {
    return true;
  }

  // Consecutive descending digits (e.g. "65432")
  let isDesc = true;
  for (let i = 1; i < pin.length; i++) {
    if (pin.charCodeAt(i) !== pin.charCodeAt(i - 1) - 1) {
      isDesc = false;
      break;
    }
  }
  if (isDesc) {
    return true;
  }

  return false;
}

export const setManagerPinSchema = z.object({
  pin: z
    .string()
    .regex(/^\d{4,8}$/, 'PIN must be between 4 and 8 digits')
    .refine((pin) => !isTrivialPin(pin), {
      message: 'PIN is too simple (repeated or sequential digits are not allowed)',
    }),
});

export type SetManagerPinInput = z.infer<typeof setManagerPinSchema>;
