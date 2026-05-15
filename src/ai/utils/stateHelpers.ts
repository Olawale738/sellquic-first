import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

async function clearAiErrorState(convRef: FirebaseFirestore.DocumentReference) {
  await convRef.set({
    aiErrorFlag: FieldValue.delete(),
    aiErrorContextActive: FieldValue.delete(),
    aiErrorCount: FieldValue.delete(),
    lastAiError: FieldValue.delete(),
    lastAiErrorMessagePreview: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function clearStuckConversationState(convRef: FirebaseFirestore.DocumentReference) {
  await convRef.set({
    status: 'active',
    awaitingStep: FieldValue.delete(),
    awaitingSince: FieldValue.delete(),
    activeFlow: FieldValue.delete(),
    activeFlowStartedAt: FieldValue.delete(),
    aiErrorFlag: FieldValue.delete(),
    aiErrorContextActive: FieldValue.delete(),
    aiErrorCount: FieldValue.delete(),
    lastAiError: FieldValue.delete(),
    lastAiErrorMessagePreview: FieldValue.delete(),
    lastNudgeSent: FieldValue.delete(),
    lastNudgeMessage: FieldValue.delete(),
    lastNudgeContextType: FieldValue.delete(),
    lastNudgeContextPayload: FieldValue.delete(),
    nudgeCount: 0,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export { clearAiErrorState, clearStuckConversationState };