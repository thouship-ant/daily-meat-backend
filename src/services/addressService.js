const { Address, ShopSettings } = require('../models');
const { calculateDistance } = require('../utils/distanceCalc');

class AddressService {
  /**
   * Adds an address for a user, calculating if it's within the delivery radius.
   * @param {string} userId - The user's ID.
   * @param {Object} addressData - The address details including lat/lng.
   * @returns {Promise<Object>} The saved address object.
   */
  async addAddress(userId, addressData) {
    const { title, street, city, pincode, latitude, longitude } = addressData;

    if (!latitude || !longitude) {
      throw new Error('Latitude and Longitude are required to calculate delivery eligibility.');
    }

    // 1. Fetch the Shop Settings (assuming we have one shop, so id=1)
    let shopSettings = await ShopSettings.findByPk(1);
    
    // If shop is not configured yet, default to deliverable = false or throw error.
    // Here we will throw an error to force admin configuration.
    if (!shopSettings) {
      throw new Error('Shop location is not configured. Cannot verify delivery radius.');
    }

    // 2. Calculate Distance (still useful for other distance-based logic if needed, but not for deliverability)
    const distanceKm = calculateDistance(
      latitude, 
      longitude, 
      shopSettings.shop_latitude, 
      shopSettings.shop_longitude
    );

    // 3. Check if deliverable based on pincode
    const isDeliverable = 
      !Array.isArray(shopSettings.deliverable_pincodes) || 
      shopSettings.deliverable_pincodes.length === 0 || 
      shopSettings.deliverable_pincodes.includes(pincode?.toString());


    // 4. Save Address
    // If it's the user's first address, make it default automatically
    const existingCount = await Address.count({ where: { user_id: userId } });
    const isDefault = existingCount === 0;

    const newAddress = await Address.create({
      user_id: userId,
      title,
      street,
      city,
      pincode,
      latitude,
      longitude,
      is_deliverable: isDeliverable,
      is_default: isDefault
    });

    return {
      address: newAddress,
      distanceKm: parseFloat(distanceKm.toFixed(2)),
      isDeliverable
    };
  }

  /**
   * Updates an existing address
   * @param {string} userId - The user's ID
   * @param {string} addressId - The address ID
   * @param {Object} addressData - Updated address details
   */
  async updateAddress(userId, addressId, addressData) {
    const address = await Address.findOne({ where: { id: addressId, user_id: userId } });
    if (!address) {
      throw new Error('Address not found or unauthorized');
    }

    const { title, street, city, pincode, latitude, longitude } = addressData;

    let isDeliverable = address.is_deliverable;
    let newDistanceKm = null;

    if (latitude && longitude && (latitude !== address.latitude || longitude !== address.longitude)) {
      const shopSettings = await ShopSettings.findByPk(1);
      if (shopSettings) {
        newDistanceKm = calculateDistance(
          latitude, 
          longitude, 
          shopSettings.shop_latitude, 
          shopSettings.shop_longitude
        );
      }
    }
    
    if (pincode && pincode !== address.pincode) {
      const shopSettings = await ShopSettings.findByPk(1);
      if (shopSettings) {
        isDeliverable = 
          !Array.isArray(shopSettings.deliverable_pincodes) || 
          shopSettings.deliverable_pincodes.length === 0 || 
          shopSettings.deliverable_pincodes.includes(pincode?.toString());
      }
    }

    await address.update({
      title: title || address.title,
      street: street || address.street,
      city: city || address.city,
      pincode: pincode || address.pincode,
      latitude: latitude || address.latitude,
      longitude: longitude || address.longitude,
      is_deliverable: isDeliverable
    });

    return {
      address,
      distanceKm: newDistanceKm !== null ? parseFloat(newDistanceKm.toFixed(2)) : undefined,
      isDeliverable
    };
  }

  /**
   * Deletes an address
   * @param {string} userId 
   * @param {string} addressId 
   */
  async deleteAddress(userId, addressId) {
    const address = await Address.findOne({ where: { id: addressId, user_id: userId } });
    if (!address) {
      throw new Error('Address not found or unauthorized');
    }
    await address.destroy();

    // If we deleted the default address, and there are others left, make the newest one default
    if (address.is_default) {
      const nextAddress = await Address.findOne({
        where: { user_id: userId },
        order: [['createdAt', 'DESC']]
      });
      if (nextAddress) {
        await nextAddress.update({ is_default: true });
      }
    }

    return true;
  }

  /**
   * Sets an address as the default for a user
   * @param {string} userId 
   * @param {string} addressId 
   */
  async setDefaultAddress(userId, addressId) {
    const address = await Address.findOne({ where: { id: addressId, user_id: userId } });
    if (!address) {
      throw new Error('Address not found or unauthorized');
    }

    // Unset default for all other addresses
    await Address.update(
      { is_default: false },
      { where: { user_id: userId } }
    );

    // Set default for this one
    await address.update({ is_default: true });

    return address;
  }

  /**
   * Fetches all addresses for a specific user.
   * @param {string} userId - The user's ID.
   * @returns {Promise<Array>} List of addresses.
   */
  async getUserAddresses(userId) {
    const addresses = await Address.findAll({
      where: { user_id: userId },
      order: [['createdAt', 'DESC']]
    });
    return addresses;
  }
}

module.exports = new AddressService();
