import type {
    InformationReply,
    KnowledgeTurnContext,
    QuestionIntent,
    Referent,
    StoreKnowledge,
  } from '../types';
  
  import { buildPriceAnswer, buildStockAnswer, buildVariantsAnswer } from './product';
  import { buildDeliveryFeeAnswer, buildDeliveryTimeAnswer } from './delivery';
  import { buildPaymentMethodsAnswer, buildCodAnswer } from './payment';
  import { buildCartTotalAnswer } from './cart';
  import { buildRefundPolicyAnswer } from './policy';
  import { buildLocationAnswer, buildHoursAnswer, buildAboutStoreAnswer } from './store';
  import { buildUnknownAnswer } from './unknown';
  
  /**
   * Single dispatch entry point. The handler calls this; nothing else should
   * import the per-intent builders directly. Keeps the contract one-function-wide
   * and makes adding a new question intent a one-line change.
   */
  export function buildAnswer(
    intent: QuestionIntent,
    ctx: KnowledgeTurnContext,
    knowledge: StoreKnowledge,
    referent: Referent,
  ): InformationReply {
    switch (intent) {
      case 'q_price':
        return buildPriceAnswer(ctx, knowledge, referent);
      case 'q_stock':
        return buildStockAnswer(ctx, knowledge, referent);
      case 'q_variants':
        return buildVariantsAnswer(ctx, knowledge, referent);
      case 'q_delivery_fee':
        return buildDeliveryFeeAnswer(ctx, knowledge, referent);
      case 'q_delivery_time':
        return buildDeliveryTimeAnswer(ctx, knowledge, referent);
      case 'q_payment_methods':
        return buildPaymentMethodsAnswer(ctx, knowledge);
      case 'q_cod':
        return buildCodAnswer(ctx, knowledge);
        case 'q_cart_total':
          return buildCartTotalAnswer(ctx, knowledge);
      case 'q_refund_policy':
        return buildRefundPolicyAnswer(ctx, knowledge);
      case 'q_location':
        return buildLocationAnswer(ctx, knowledge);
      case 'q_hours':
        return buildHoursAnswer(ctx, knowledge);
      case 'q_about_store':
        return buildAboutStoreAnswer(ctx, knowledge);
      case 'q_unknown':
        return buildUnknownAnswer(ctx, knowledge, ctx.customerMessage);
    }
  }