import type { TurnContext } from '../types';

export function buildCheckoutConfirmationQuestion(ctx: TurnContext): string {
  const deliveryLabel = ctx.orderSession.deliveryLabel;
  const deliveryFee = ctx.orderSession.deliveryFee;
  const address = ctx.customer.address || ctx.orderSession.customerAddress;
  const phone = ctx.customer.phone;
  const name = ctx.customer.name;

  const detailLines: string[] = [];

  if (deliveryLabel) {
    detailLines.push(
      `Delivery: ${deliveryLabel}${typeof deliveryFee === 'number' ? ` — GHS ${deliveryFee}` : ''}`
    );
  }

  if (address) detailLines.push(`Address: ${address}`);
  if (phone) detailLines.push(`Phone: ${phone}`);
  if (name) detailLines.push(`Name: ${name}`);

  if (!detailLines.length) {
    return 'Should I go ahead and create the checkout link?';
  }

  return `I have these order details please:\n\n${detailLines.join(
    '\n'
  )}\n\nShould I use these and create the checkout link?`;
}