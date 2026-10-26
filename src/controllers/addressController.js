const addressService = require('../services/addressService');

class AddressController {
  /**
   * Endpoint to add a new address.
   */
  async addAddress(req, res) {
    try {
      const userId = req.user.id;
      const addressData = req.body;

      const result = await addressService.addAddress(userId, addressData);

      res.status(201).json({
        message: result.isDeliverable 
          ? 'Address added. We deliver to this location!' 
          : 'Address added, but it is outside our delivery area.',
        data: result
      });
    } catch (error) {
      console.error('Error adding address:', error.message);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Endpoint to get all addresses for the logged-in user.
   */
  async getUserAddresses(req, res) {
    try {
      const userId = req.user.id;
      const addresses = await addressService.getUserAddresses(userId);
      
      res.status(200).json({
        message: 'Addresses fetched successfully',
        data: addresses
      });
    } catch (error) {
      console.error('Error fetching addresses:', error.message);
      res.status(500).json({ error: 'Internal server error while fetching addresses.' });
    }
  }

  /**
   * Endpoint to update an existing address
   */
  async updateAddress(req, res) {
    try {
      const userId = req.user.id;
      const addressId = req.params.id;
      const addressData = req.body;

      const result = await addressService.updateAddress(userId, addressId, addressData);

      res.status(200).json({
        message: result.isDeliverable 
          ? 'Address updated. We deliver to this location!' 
          : 'Address updated, but it is outside our delivery area.',
        data: result
      });
    } catch (error) {
      console.error('Error updating address:', error.message);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Endpoint to delete an address
   */
  async deleteAddress(req, res) {
    try {
      const userId = req.user.id;
      const addressId = req.params.id;

      await addressService.deleteAddress(userId, addressId);

      res.status(200).json({
        message: 'Address deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting address:', error.message);
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Endpoint to set an address as default
   */
  async setDefaultAddress(req, res) {
    try {
      const userId = req.user.id;
      const addressId = req.params.id;

      const address = await addressService.setDefaultAddress(userId, addressId);

      res.status(200).json({
        message: 'Default address updated successfully',
        data: address
      });
    } catch (error) {
      console.error('Error setting default address:', error.message);
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new AddressController();
