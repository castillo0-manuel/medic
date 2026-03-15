import Purchases, { LOG_LEVEL, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

const API_KEY_ANDROID = 'test_ixLpffPaoxIwWZyWYgzRUZRnSbh';

export async function initializePurchases() {
  Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  if (Platform.OS === 'android') {
    await Purchases.configure({ apiKey: API_KEY_ANDROID });
  }
}

export async function getOfferings() {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch (e) {
    console.error('Error getting offerings:', e);
    return [];
  }
}

export async function purchasePackage(pkg: PurchasesPackage) {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active['MediReminder Pro'] !== undefined;
  } catch (e: any) {
    if (!e.userCancelled) {
      console.error('Error purchasing:', e);
    }
    return false;
  }
}

export async function restorePurchases() {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo.entitlements.active['MediReminder Pro'] !== undefined;
  } catch (e) {
    console.error('Error restoring:', e);
    return false;
  }
}

export async function checkSubscriptionStatus(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo.entitlements.active['MediReminder Pro'] !== undefined;
  } catch (e) {
    return false;
  }
}