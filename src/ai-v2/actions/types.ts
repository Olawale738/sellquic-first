import type {
    CartItemV2,
    DeliveryZoneV2,
    PersistedCommerceState,
  } from '../types';
  import type { BuiltCheckout } from '../checkout/buildCheckout';
  
  export type CommerceAction =
    | {
        type: 'CLEAR_CHECKOUT';
        reason?: string;
      }
    | {
        type: 'CLEAR_CART';
        reason?: string;
      }
    | {
        type: 'REPLACE_CART';
        items: CartItemV2[];
        reason?: string;
      }
    | {
        type: 'SET_DELIVERY';
        zone: DeliveryZoneV2;
        reason?: string;
      }
    | {
        type: 'SET_ADDRESS';
        address: string;
        reason?: string;
      }
    | {
        type: 'SET_PHONE';
        phone: string;
        reason?: string;
      }
    | {
        type: 'SET_NAME';
        name: string;
        reason?: string;
      }
    | {
        type: 'SET_COMMERCE_STATE';
        state: PersistedCommerceState;
        reason?: string;
      }
    | {
        type: 'DERIVE_NEXT_STATE';
        statePatch?: Partial<PersistedCommerceState>;
        reason?: string;
      }
    | {
        type: 'SAVE_CHECKOUT';
        checkout: BuiltCheckout;
        reason?: string;
      };
  
  export type CommerceActionExecutionResult = {
    actionTypes: string[];
    checkoutInvalidated: boolean;
    reasonSummary: string[];
  };