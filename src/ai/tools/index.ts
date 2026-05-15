
const SchemaType = {
  OBJECT: 'object',
  ARRAY: 'array',
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
} as const;


export const tools: any[] = [{
  functionDeclarations: [
    {
      name: 'remove_from_cart',
      description: 'Remove specific items from the bag. Pass variantIds in the same order as productIds to remove a specific variant only.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          productIds: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Product IDs to remove.' },
          variantIds: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Matching variantId for each productId. Pass empty string if no variant.' },
          message: { type: SchemaType.STRING }
        },
        required: ['productIds', 'message']
      }
    },



    {
      name: 'add_to_cart',
      description: "MANDATORY when a customer has confirmed the product, variant/size, and quantity. Use this BEFORE create_checkout so the cart is saved server-side. Do not wait until checkout to save selected items. CRITICAL: Always pass the FINAL intended quantity, not a delta. If cart has Pink x3 and customer says 'add 2 more', pass Pink x5. If customer says 'make it 2', pass Pink x2. The system SETS the quantity — it does not add to existing.",
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string', description: 'The exact ID of the product.' },
                variantId: { type: 'string', description: 'The exact ID of the variant/size, if applicable.' },
                quantity: { type: 'number', description: 'The quantity to add.' }
              },
              required: ['productId', 'quantity']
            }
          }
        },
        required: ['items']
      }
    },
    
    {
      name: 'create_checkout',
      description: `Call when user confirms they want to buy something.
CRITICAL: Always pass the COMPLETE final list of ALL items the customer wants — not just what changed.
The current cart state is in your system prompt. Use it to calculate the full updated cart.
Examples:
- Cart has Pink x2, Fenty x1. Customer adds 1 pink → pass Pink x3, Fenty x1.
- Cart has Pink x3, Fenty x1. Customer says make it 2 pink → pass Pink x2, Fenty x1.
- Fresh order → pass exactly what they asked for.
NEVER call this for payment timing questions or when customer is asking a question.`,
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          items: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                productId: { type: SchemaType.STRING },
                variantId: { type: SchemaType.STRING },
                quantity: { type: SchemaType.NUMBER }
              },
              required: ['productId', 'quantity']
            }
          },
          customerMessage: {
            type: SchemaType.STRING,
            description: 'Warm confirmation message showing the full updated cart.'
          },
          deliveryId: {
            type: SchemaType.STRING,
            description: 'The delivery option ID matching the customer location. Only pass if customer confirmed their area and it matches an available zone.'
          },
          customerName: {
            type: SchemaType.STRING,
            description: 'The customer first name if they shared it during the conversation.'
          },
          customerPhone: {
            type: SchemaType.STRING,
            description: 'The customer phone number if they shared it during the conversation.'
          },
          customerAddress: {
            type: SchemaType.STRING,
            description: 'The specific delivery address or landmark shared by the customer.'
          }
        },
        required: ['items', 'customerMessage']
      }
    },
    
    {
      name: 'lookup_order',
      description: 'Look up a customer\'s order by their payment reference code (format: BEST-XXXXX). CRITICAL: You MUST provide paymentReference. Do NOT call with only phone or name — the system requires a reference code. If the customer has not provided one, ask for it first before calling this tool.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          phone: {
            type: SchemaType.STRING,
            description: 'Customer phone in any format. System handles 0XX and 233XX variants automatically.'
          },
          name: {
            type: SchemaType.STRING,
            description: 'Customer name as stated.'
          },
          paymentReference: {
            type: SchemaType.STRING,
            description: 'Any order or payment reference code in any format.'
          }
        }
      }
    },
    {
      name: 'search_catalog',
      description: 'Search the full product catalog by keyword. Use this whenever the customer asks for a specific product, color, size, category, or item name (including misspellings or natural Ghanaian phrasing like "sun flower set" or "ringlite"). IMPORTANT: Only show products that directly match the customer request. If no direct match exists, clearly say the item is not in the catalog first, then ask whether the customer wants related alternatives. NEVER show unrelated products as if they match the request. NEVER dump the whole catalog unless the customer explicitly asks to browse everything. Always end the response with a clear next-step sales question.',
      parameters: {
        type: 'object',
        properties: {
          searchTerm: { type: 'string', description: 'The customer\'s exact search phrase.' },
          message: { type: 'string', description: 'Optional warm message from the model.' }
        },
        required: ['searchTerm']
      }
    },


    {
      name: 'notify_vendor',
      description: 'Use this when you cannot answer a customer question and need to notify the vendor to follow up. Call this instead of promising to "check and get back" — this actually notifies the vendor. The customer stays in the conversation, no handover needed.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          question: {
            type: SchemaType.STRING,
            description: 'The exact question or topic the customer asked about that needs vendor attention'
          },
          replyToCustomer: {
            type: SchemaType.STRING,
            description: 'Warm message to send to the customer letting them know you\'ve flagged it'
          }
        },
        required: ['question', 'replyToCustomer']
      }
    },





    {
      name: 'save_customer_info',
      description: 'Call ONLY when customer shares their phone number. Do NOT call this just for a name — names are saved automatically during checkout.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          customerName: { type: SchemaType.STRING },
          customerPhone: { type: SchemaType.STRING },
        }
      }
    }
  ]
}];
