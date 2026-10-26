const { ShopSettings } = require('../models');

class ShopSettingsController {
  /**
   * Endpoint to get the current shop settings.
   */
  async getSettings(req, res) {
    try {
      let settings = await ShopSettings.findByPk(1);
      if (!settings) {
        settings = await ShopSettings.create({
          id: 1,
          shop_latitude: 17.385044,
          shop_longitude: 78.486671,
          delivery_radius_km: 10.0
        });
      }
      res.status(200).json({ data: settings });
    } catch (error) {
      console.error('Error fetching shop settings:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Endpoint to update the shop settings (latitude, longitude, delivery radius).
   * Note: In a real app, you would restrict this to Admin users only.
   */
  async updateSettings(req, res) {
    try {
      const { 
        shop_latitude, 
        shop_longitude, 
        delivery_radius_km,
        min_order_for_free_delivery,
        delivery_fee_amount,
        free_delivery_distance_km,
        distance_delivery_fee_amount,
        delivery_fee_strategy,
        store_start_time,
        store_close_time,
        orders_paused,
        pause_reason
      } = req.body;
      
      let settings = await ShopSettings.findByPk(1);
      if (!settings) {
        settings = await ShopSettings.create({
          id: 1,
          shop_latitude: 17.385044,
          shop_longitude: 78.486671,
          delivery_radius_km: 10.0
        });
      }

      if (shop_latitude !== undefined) settings.shop_latitude = shop_latitude;
      if (shop_longitude !== undefined) settings.shop_longitude = shop_longitude;
      if (delivery_radius_km !== undefined) settings.delivery_radius_km = delivery_radius_km;
      if (min_order_for_free_delivery !== undefined) settings.min_order_for_free_delivery = min_order_for_free_delivery;
      if (delivery_fee_amount !== undefined) settings.delivery_fee_amount = delivery_fee_amount;
      if (free_delivery_distance_km !== undefined) settings.free_delivery_distance_km = free_delivery_distance_km;
      if (distance_delivery_fee_amount !== undefined) settings.distance_delivery_fee_amount = distance_delivery_fee_amount;
      if (delivery_fee_strategy !== undefined) settings.delivery_fee_strategy = delivery_fee_strategy;
      if (store_start_time !== undefined) settings.store_start_time = store_start_time;
      if (store_close_time !== undefined) settings.store_close_time = store_close_time;
      if (orders_paused !== undefined) settings.orders_paused = orders_paused;
      if (pause_reason !== undefined) settings.pause_reason = pause_reason;
      if (req.body.deliverable_pincodes !== undefined) settings.deliverable_pincodes = req.body.deliverable_pincodes;
      if (req.body.distance_tiers !== undefined) settings.distance_tiers = req.body.distance_tiers;

      await settings.save();

      res.status(200).json({
        message: 'Shop settings updated successfully',
        data: settings
      });
    } catch (error) {
      console.error('Error updating shop settings:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = new ShopSettingsController();
