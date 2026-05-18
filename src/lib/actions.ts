'use server';

import { authAdmin, db } from './firebase-admin';
import { Resend } from 'resend';
import { revalidatePath } from 'next/cache';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { slugify } from './utils';
import { generateAutoStoreConfig } from './store-ai';

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Default categories per business type ────────────────────────────────────
const DEFAULT_CATEGORIES: Record<string, string[]> = {
  fashion:     ['Dresses', 'Tops & Blouses', 'Shoes', 'Bags', 'Accessories'],
  clothing:    ['Men', 'Women', 'Kids', 'Shoes', 'Accessories'],
  food:        ['Meals', 'Snacks', 'Drinks', 'Catering'],
  restaurant:  ['Main Course', 'Starters', 'Drinks', 'Desserts'],
  beauty:      ['Skincare', 'Haircare', 'Makeup', 'Fragrance'],
  cosmetics:   ['Face', 'Lips', 'Eyes', 'Body'],
  electronics: ['Phones', 'Gadgets', 'Accessories', 'Repairs'],
  tech:        ['Phones', 'Laptops', 'Accessories', 'Smart Devices'],
  furniture:   ['Living Room', 'Bedroom', 'Office', 'Decor'],
  home:        ['Living Room', 'Kitchen', 'Bedroom', 'Garden'],
  groceries:   ['Fresh Food', 'Pantry', 'Drinks', 'Household'],
  services:    ['Packages', 'Bookings', 'Consultations', 'Custom Requests'],
  general:     ['New Arrivals', 'Best Sellers', 'Featured', 'Sale'],
};

function getDefaultCategories(category: string): string[] {
  const key = (category || '').toLowerCase().trim();
  return (
    DEFAULT_CATEGORIES[key] ||
    DEFAULT_CATEGORIES['general']
  );
}

// ─── AI storefront config generator (delegates to shared store-ai utility) ───
async function generateStorefrontConfig(
  businessName: string,
  category: string,
  subcategory: string,
  email: string,
  phone: string,
) {
  return generateAutoStoreConfig({ businessName, category, subcategory, email, phone });
}

function generateReferralCode(name: string) {
  const prefix = (name || 'USER')
    .substring(0, 4)
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}${randomPart}`;
}

// --- OTP SYSTEM WITH RATE LIMITING ---

export async function sendOtpAction(
  userId: string,
  email: string,
  name: string
) {
  try {
    const otpRef = db
      .collection('users')
      .doc(userId)
      .collection('private')
      .doc('otp');

    const now = Date.now();
    const otpSnap = await otpRef.get();

    let sendCount = 0;
    let firstSentAt: Date | null = null;
    let lastSentAt: Date | null = null;

    if (otpSnap.exists) {
      const data = otpSnap.data() as any;

      if (data.firstSentAt instanceof Date) {
        firstSentAt = data.firstSentAt;
      } else if (data.firstSentAt?.toDate) {
        firstSentAt = data.firstSentAt.toDate();
      }

      if (data.lastSentAt instanceof Date) {
        lastSentAt = data.lastSentAt;
      } else if (data.lastSentAt?.toDate) {
        lastSentAt = data.lastSentAt.toDate();
      }

      sendCount = typeof data.sendCount === 'number' ? data.sendCount : 0;

      // 1) Hard cooldown: 60 seconds between any two sends
      if (lastSentAt && now - lastSentAt.getTime() < 60_000) {
        return {
          success: false,
          message: 'Please wait a minute before requesting another code.',
        };
      }

      // 2) Daily cap: max 5 sends in 24h window
      if (
        firstSentAt &&
        now - firstSentAt.getTime() < 24 * 60 * 60_000 &&
        sendCount >= 5
      ) {
        return {
          success: false,
          message:
            'You have requested too many codes today. Please try again later.',
        };
      }
    }

    // Generate new code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Reset or increment daily window
    const within24h =
      firstSentAt && now - firstSentAt.getTime() < 24 * 60 * 60_000;

    const newFirstSentAt = within24h ? firstSentAt! : new Date();
    const newSendCount = within24h ? sendCount + 1 : 1;

    await otpRef.set(
      {
        code,
        expiresAt: new Date(now + 10 * 60_000), // 10 minutes
        email,
        lastSentAt: new Date(),
        firstSentAt: newFirstSentAt,
        sendCount: newSendCount,
      },
      { merge: true }
    );

    await resend.emails.send({
      from: 'SellQuic <noreply@sellquic.com>',
      to: email,
      subject: `${code} is your SellQuic activation code`,
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: auto; border: 1px solid #eee; padding: 30px; border-radius: 20px; text-align: center;">
          <h2 style="color: #A155E5; margin-bottom: 10px;">Verify your account</h2>
          <p style="color: #666; font-size: 14px;">Welcome to SellQuic! Use the code below to activate your store:</p>
          <div style="background: #f9f9f9; padding: 20px; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #000; border-radius: 12px; margin: 25px 0; border: 1px solid #eee;">
            ${code}
          </div>
          <p style="color: #999; font-size: 12px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });

    return { success: true };
  } catch (e: any) {
    console.error('Resend Error:', e.message);
    return {
      success: false,
      message: 'Failed to send email. Please try again.',
    };
  }
}

// -----------------------------------------------------
// VERIFY OTP (NEW SIGNUP + EMAIL CHANGE + SIMPLE VERIFY)
// -----------------------------------------------------

interface VerifyParams {
  userId: string;
  otp: string;
  email: string;
  firstName: string;
  lastName: string;
  businessName: string;
  phone: string;
  affiliateCode?: string;
  businessCategory?: string;
  subcategory?: string;
}

export async function verifyOtpAction(
  userIdOrParams: string | VerifyParams,
  otp?: string,
  isEmailChange = false,
  newEmail?: string
): Promise<{ success: boolean; message?: string }> {
  let userId: string;
  let otpCode: string;
  let signupData: Omit<VerifyParams, 'userId' | 'otp'> | null = null;

  if (typeof userIdOrParams === 'string') {
    userId = userIdOrParams;
    otpCode = otp!;
  } else {
    userId = userIdOrParams.userId;
    otpCode = userIdOrParams.otp;
    signupData = {
      email: userIdOrParams.email,
      firstName: userIdOrParams.firstName,
      lastName: userIdOrParams.lastName,
      businessName: userIdOrParams.businessName,
      phone: userIdOrParams.phone,
      affiliateCode: userIdOrParams.affiliateCode,
      businessCategory: userIdOrParams.businessCategory,
      subcategory: userIdOrParams.subcategory,
    };
  }

  try {
    const otpRef = db
      .collection('users')
      .doc(userId)
      .collection('private')
      .doc('otp');
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      return {
        success: false,
        message: 'Code expired. Request a new one.',
      };
    }

    const otpData = otpDoc.data() as any;
    const { code, expiresAt, email: otpEmail } = otpData;

    let expiresAtDate: Date;
    if (expiresAt instanceof Date) {
      expiresAtDate = expiresAt;
    } else if (expiresAt?.toDate) {
      expiresAtDate = expiresAt.toDate();
    } else {
      expiresAtDate = new Date(0);
    }

    if (new Date() > expiresAtDate) {
      return { success: false, message: 'Code expired. Request a new one.' };
    }
    if (otpCode !== code) {
      return { success: false, message: 'Invalid code. Please check and try again.' };
    }

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    const existingData = userSnap.data();

    // 1️⃣ EMAIL CHANGE FLOW
    if (isEmailChange && newEmail) {
      if (otpEmail && newEmail.toLowerCase() !== otpEmail.toLowerCase()) {
        return {
          success: false,
          message: 'Email mismatch. The verification code was sent to a different email address.',
        };
      }

      try {
        const existingUser = await authAdmin.getUserByEmail(newEmail.toLowerCase());
        if (existingUser.uid !== userId) {
          return {
            success: false,
            message: 'This email is already registered to another account.',
          };
        }
      } catch (error: any) {
        if (error.code !== 'auth/user-not-found') {
          console.error('Error checking email:', error);
          return {
            success: false,
            message: 'Failed to verify email availability. Please try again.',
          };
        }
      }

      await authAdmin.updateUser(userId, {
        email: newEmail.toLowerCase(),
        emailVerified: true,
      });

      await userRef.update({
        email: newEmail.toLowerCase(),
        emailVerified: true,
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Email changed for user ${userId} to ${newEmail}`);
    }
    // 2️⃣ NEW SIGNUP FLOW
    else if (signupData) {
      const businessNameSlug = slugify(signupData.businessName);
      const displayName = `${signupData.firstName} ${signupData.lastName}`;

      // ✅ FIX: Use signupData.affiliateCode consistently (was using bare `affiliateCode` variable)
      const resolvedAffiliateCode = signupData.affiliateCode
        ? String(signupData.affiliateCode).trim().toUpperCase()
        : null;

      const [phoneCheck, slugCheck] = await Promise.all([
        db
          .collection('users')
          .where('phone', '==', signupData.phone)
          .limit(1)
          .get(),
        db
          .collection('stores')
          .where('subdomain', '==', businessNameSlug)
          .limit(1)
          .get(),
      ]);

      if (!phoneCheck.empty && phoneCheck.docs[0].id !== userId) {
        return {
          success: false,
          message: 'Phone number already registered.',
        };
      }

      if (!slugCheck.empty) {
        return {
          success: false,
          message: 'Business name already taken.',
        };
      }

      await authAdmin.updateUser(userId, {
        email: signupData.email.toLowerCase(),
        displayName,
        emailVerified: true,
      });

      // 🔥 FETCH SUPER ADMIN SETTINGS FOR FREE TRIAL
      const settingsSnap = await db.collection('settings').doc('platform').get();
      const adminSettings = settingsSnap.data() || {};
      const trialConfig = adminSettings.trial;

      // 🌟 THE VIP CODES YOUR TEAM WILL GIVE OUT ON CALLS
      const VIP_CODES = ['VIP14', 'LAUNCH14', 'SELLQUIC14'];
      const isVipCodeUsed = resolvedAffiliateCode && VIP_CODES.includes(resolvedAffiliateCode);

      // Auto-start a trial for every new signup so the store is live from day one.
      // VIP code holders get 14 days; everyone else gets 7 days (or admin-configured value).
      const trialDays = isVipCodeUsed ? 14 : (trialConfig?.durationDays || 7);
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

      let subscriptionConfig: any = {
        planId: 'trial',
        status: 'trial',
        trialEndsAt: Timestamp.fromMillis(trialEndsAt.getTime()),
        startDate: Timestamp.fromDate(new Date()),
        endDate: null,
        billingCycle: null,
        hasUsedTrial: true,
        updatedAt: FieldValue.serverTimestamp(),
      };
      let initialCredits = 0;
      let promoAccessConfig: any = null;

      if (isVipCodeUsed) {
        // 🚀 VIP BONUS: Extra AI credits on top of the 14-day trial
        promoAccessConfig = {
          type: 'launch_offer',
          startsAt: FieldValue.serverTimestamp(),
          endsAt: Timestamp.fromMillis(trialEndsAt.getTime()),
          grantedBy: 'signup_code',
          grantedAt: FieldValue.serverTimestamp(),
          revokedAt: null,
          notes: `Used code: ${resolvedAffiliateCode}`,
        };
        initialCredits = 1000;
      } else {
        initialCredits = trialConfig?.aiCredits || 500;
      }
      const batch = db.batch();

      // Resolve affiliate
      let referredBy: string | null = null;
      if (resolvedAffiliateCode) {
        const affiliateQuery = await db
          .collection('users')
          .where('referralCode', '==', resolvedAffiliateCode)
          .limit(1)
          .get();

        if (!affiliateQuery.empty) {
          referredBy = affiliateQuery.docs[0].id;
          // Prevent self-referral
          if (referredBy === userId) {
            referredBy = null;
          }
        }
      }

      const newUserDoc = {
        uid: userId,
        displayName,
        firstName: signupData.firstName,
        lastName: signupData.lastName,
        email: signupData.email.toLowerCase(),
        phone: signupData.phone,
        businessName: signupData.businessName,
        businessNameSlug,
        referredBy,
        signupDiscountEligible: referredBy !== null,
        signupDiscountUsed: false,
        status: 'active',
        emailVerified: true,
        isBetaTester: false,
        referralCode: generateReferralCode(displayName),
        subscription: subscriptionConfig,
        promoAccess: promoAccessConfig,
       
        createdAt: existingData?.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        affiliateWallet: {
          available: existingData?.affiliateWallet?.available ?? 0,
          pending: existingData?.affiliateWallet?.pending ?? 0,
          paid: existingData?.affiliateWallet?.paid ?? 0,
        },
        role: existingData?.role || 'vendor',
      };

      batch.set(userRef, newUserDoc, { merge: true });

      if (initialCredits > 0) {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setDate(periodEnd.getDate() + 14);
      
        const creditRef = userRef.collection('ai_credit_periods').doc();
      
        batch.set(creditRef, {
          planId: subscriptionConfig.planId,
          status: 'active',
          totalCredits: initialCredits,
          usedCredits: 0,
          remainingCredits: initialCredits,
          periodStart: Timestamp.fromDate(now),
          periodEnd: Timestamp.fromDate(periodEnd),
          source: isVipCodeUsed ? 'vip_signup_code' : 'signup_trial',
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }


      // Create store
      const category = signupData.businessCategory || 'general';
      const subcategory = signupData.subcategory || category;
      const storeRef = db.collection('stores').doc();
      batch.set(storeRef, {
        sellerId: userId,
        name: signupData.businessName,
        subdomain: businessNameSlug,
        category,
        subcategory,
        createdAt: FieldValue.serverTimestamp(),
        status: 'active',
        aiAssistant: {
          enabled: initialCredits > 0,
          channels: {
            web: true,
            whatsapp: true,
            instagram: true,
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
      });

      // Affiliate referral record + wallet
      if (referredBy) {
        const affiliateRef = db.collection('users').doc(referredBy);
        const referralDocRef = affiliateRef.collection('referrals').doc();

        batch.set(referralDocRef, {
          userId,
          userName: displayName,
          email: signupData.email.toLowerCase(),
          isPro: false,
          status: 'pending',
          amount: 0,
          createdAt: FieldValue.serverTimestamp(),
          // ✅ FIX: Use resolvedAffiliateCode, not bare `affiliateCode`
          referralCode: resolvedAffiliateCode,
        });

        batch.set(
          affiliateRef,
          {
            affiliateWallet: {
              pending: FieldValue.increment(0),
            },
          },
          { merge: true }
        );
      }

      await batch.commit();

      // ─── Auto-build: create default categories + AI storefront config ───
      try {
        const defaultCats = getDefaultCategories(category);
        const catWritePromises = defaultCats.map((name) =>
          storeRef.collection('categories').add({
            name,
            createdAt: FieldValue.serverTimestamp(),
          })
        );

        const [result] = await Promise.all([
          generateStorefrontConfig(
            signupData!.businessName,
            category,
            subcategory,
            signupData!.email,
            signupData!.phone,
          ),
          ...catWritePromises,
        ]);

        if (result) {
          await storeRef.update({
            storefrontConfig: result.storefrontConfig,
            autoStoreConfig: result.autoStoreConfig,
            storefrontGeneratedAt: FieldValue.serverTimestamp(),
          });
        }
      } catch (buildErr) {
        // Non-fatal — store is created, categories or AI config failed silently
        console.error('[auto-build storefront]', buildErr);
      }

      // Welcome email
      try {
        await resend.emails.send({
          from: 'Rena from SellQuic <hello@sellquic.com>',
          to: signupData.email,
          subject: 'Welcome to SellQuic 🎉',
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 40px 20px; background: #fff;">
              <div style="text-align: left; margin-bottom: 24px;">
                <h1 style="color: #111827; font-size: 28px; font-weight: 800; margin: 0 0 8px 0;">Welcome to SellQuic 🎉</h1>
              </div>
      
              <p style="color: #374151; font-size: 15px; line-height: 1.7; margin: 0 0 12px 0;">
                We're happy you're here.
              </p>
              <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 12px 0;">
                If you sell online or on social media, you already know the stress. Repeating prices, sending product pictures all day, answering the same questions, missing orders when you're busy, or worrying whether payment has really come in.
              </p>
              <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
                SellQuic was built to make selling easier and more organised, so you can focus on growing your business instead of chasing messages.
              </p>
      
              <h3 style="color: #111827; font-size: 16px; font-weight: 700; margin: 0 0 10px 0;">Here's how SellQuic helps 👇</h3>
      
              <p style="color: #111827; font-weight: 600; margin: 16px 0 4px 0;">🛒 Your Online Store.</p>
              <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 12px 0;">
                Create a simple, mobile friendly online store where all your products are neatly displayed.
                Instead of sending prices and pictures one by one, you can share your store link anywhere you sell online or on social media.
                Customers can browse and order anytime, even when you're offline.
              </p>
      
              <p style="color: #111827; font-weight: 600; margin: 16px 0 4px 0;">💸 Accept Local and Global Payments.</p>
              <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 12px 0;">
                SellQuic lets your customers pay you locally and internationally through your store and payment links.
                Your payments are tracked in one place, so you don't have to rely on screenshots or guess whether money has come in.
              </p>
      
              <p style="color: #111827; font-weight: 600; margin: 16px 0 4px 0;">🔔 Instant Order Alerts</p>
              <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 12px 0;">
                The moment a customer places an order, you get notified instantly.
                No more checking messages all the time or worrying that you missed a sale. You'll always know when an order comes in.
              </p>
      
              <p style="color: #111827; font-weight: 600; margin: 16px 0 4px 0;">📦 Stay Organised</p>
              <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 12px 0;">
                All your products, orders, and customers are recorded automatically in one dashboard.
                This helps you stay organised, fulfil orders faster, and run your business more confidently.
              </p>
      
              <p style="color: #111827; font-weight: 600; margin: 16px 0 4px 0;">🚀 Pick Your Plan</p>
              <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 12px 0;">
                Choose Starter, Standard, or Growth from your dashboard. Standard and Growth come with a 7-day free trial — no credit card needed.
              </p>
      
              <p style="color: #111827; font-weight: 600; margin: 16px 0 4px 0;">🚀 Start with one simple step</p>
              <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">
                Add your first product to your store and share your store link with customers.
                That's all it takes to get started.
              </p>
      
              <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
                If you ever need help, our team is here to support you every step of the way.
              </p>
      
              <div style="text-align: center; margin: 28px 0;">
                <a href="https://sellquic.com/dashboard"
                   style="display: inline-block; background: #A155E5; color: #fff; padding: 14px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 15px;">
                  👉 Click here to go back to your dashboard and finish setting up your store
                </a>
              </div>
      
              <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 0 0 8px 0;">
                Welcome once again. We're excited to support your selling journey.
              </p>
      
              <p style="color: #4B5563; font-size: 15px; line-height: 1.7; margin: 16px 0 0 0;">
                Warm regards,<br/>
                <strong>Rena</strong><br/>
                <span style="color: #6B7280;">For the SellQuic Team</span>
              </p>
            </div>
          `,
        });
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    }
    // 3️⃣ SIMPLE VERIFY
    else {
      await authAdmin.updateUser(userId, { emailVerified: true });

      await userRef.update({
        emailVerified: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await otpRef.delete();
    revalidatePath('/dashboard');
    return { success: true };
  } catch (e: any) {
    console.error('Verification Error:', e);
    return {
      success: false,
      message: e.message || 'Verification failed. Please try again.',
    };
  }
}

// ─── Regenerate AI store config from the dashboard ───────────────────────────
export async function regenerateStoreConfigAction(
  storeId: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const storeRef = db.collection('stores').doc(storeId);
    const storeSnap = await storeRef.get();
    if (!storeSnap.exists) {
      return { success: false, message: 'Store not found.' };
    }

    const store = storeSnap.data()!;
    const sellerSnap = await db.collection('users').doc(store.sellerId).get();
    const seller = sellerSnap.data();

    const result = await generateAutoStoreConfig({
      businessName: store.name ?? '',
      category: store.category ?? 'general',
      subcategory: store.subcategory ?? '',
      email: seller?.email ?? store.email ?? '',
      phone: seller?.phone ?? store.sellerPhone ?? '',
    });

    if (!result) {
      return { success: false, message: 'AI generation failed. Please try again.' };
    }

    await storeRef.update({
      storefrontConfig: result.storefrontConfig,
      autoStoreConfig: result.autoStoreConfig,
      storefrontGeneratedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath(`/dashboard/stores/${storeId}/launch-kit`);
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[regenerateStoreConfigAction]', err);
    return { success: false, message };
  }
}
