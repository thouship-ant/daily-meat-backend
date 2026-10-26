const { Banner } = require('../models');

// Public route to get all active banners
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.findAll({
      where: { is_active: true },
      order: [['createdAt', 'DESC']]
    });
    res.json({ data: banners });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
};

// Admin route to get all banners
exports.getAdminBanners = async (req, res) => {
  try {
    const banners = await Banner.findAll({
      order: [['createdAt', 'DESC']]
    });
    res.json({ data: banners });
  } catch (error) {
    console.error('Error fetching admin banners:', error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
};

// Admin route to create a banner
exports.createBanner = async (req, res) => {
  try {
    const { title, is_active } = req.body;
    let image_url = null;

    if (req.file) {
      image_url = req.file.path || req.file.location;
    }

    if (!image_url) {
      return res.status(400).json({ error: 'Image is required for a banner' });
    }

    const banner = await Banner.create({
      title,
      image_url,
      is_active: is_active === undefined ? true : is_active === 'true' || is_active === true
    });

    res.status(201).json({ data: banner });
  } catch (error) {
    console.error('Error creating banner:', error);
    res.status(500).json({ error: 'Failed to create banner' });
  }
};

// Admin route to update a banner
exports.updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, is_active } = req.body;
    const banner = await Banner.findByPk(id);

    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    if (req.file) {
      banner.image_url = req.file.path || req.file.location;
    }

    if (title !== undefined) banner.title = title;
    if (is_active !== undefined) banner.is_active = is_active === 'true' || is_active === true;

    await banner.save();
    res.json({ data: banner });
  } catch (error) {
    console.error('Error updating banner:', error);
    res.status(500).json({ error: 'Failed to update banner' });
  }
};

// Admin route to delete a banner
exports.deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByPk(id);

    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    await banner.destroy();
    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    console.error('Error deleting banner:', error);
    res.status(500).json({ error: 'Failed to delete banner' });
  }
};

// Admin route to toggle active status
exports.toggleBannerStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const banner = await Banner.findByPk(id);

    if (!banner) {
      return res.status(404).json({ error: 'Banner not found' });
    }

    banner.is_active = !banner.is_active;
    await banner.save();

    res.json({ message: 'Banner status updated', data: banner });
  } catch (error) {
    console.error('Error toggling banner status:', error);
    res.status(500).json({ error: 'Failed to toggle banner status' });
  }
};
