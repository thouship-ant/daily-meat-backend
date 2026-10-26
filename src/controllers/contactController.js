const { ContactMessage } = require('../models');

class ContactController {
  /**
   * Submit a contact message from the website
   * POST /contact  (public - no auth required)
   */
  async submitContact(req, res) {
    try {
      const { name, email, message } = req.body;

      if (!name || !email || !message) {
        return res.status(400).json({ error: 'name, email, and message are required.' });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email address.' });
      }

      const contact = await ContactMessage.create({ name, email, message });

      res.status(201).json({
        message: 'Your message has been received. We will get back to you shortly!',
        id: contact.id,
      });
    } catch (error) {
      console.error('Submit contact error:', error.message);
      res.status(500).json({ error: 'Failed to submit contact message.' });
    }
  }

  /**
   * Get all contact messages (admin only)
   * GET /admin/contacts
   */
  async getAllContacts(req, res) {
    try {
      const contacts = await ContactMessage.findAll({
        order: [['created_at', 'DESC']],
      });
      res.status(200).json(contacts);
    } catch (error) {
      console.error('Get all contacts error:', error.message);
      res.status(500).json({ error: 'Failed to fetch contact messages.' });
    }
  }

  /**
   * Update contact message status (admin only)
   * PUT /admin/contacts/:id/status
   */
  async updateContactStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const validStatuses = ['UNREAD', 'READ', 'REPLIED'];
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
      }

      const contact = await ContactMessage.findByPk(id);
      if (!contact) {
        return res.status(404).json({ error: 'Contact message not found.' });
      }

      await contact.update({ status });
      res.status(200).json({ message: 'Status updated successfully.', contact });
    } catch (error) {
      console.error('Update contact status error:', error.message);
      res.status(500).json({ error: 'Failed to update contact status.' });
    }
  }

  /**
   * Delete a contact message (admin only)
   * DELETE /admin/contacts/:id
   */
  async deleteContact(req, res) {
    try {
      const { id } = req.params;

      const contact = await ContactMessage.findByPk(id);
      if (!contact) {
        return res.status(404).json({ error: 'Contact message not found.' });
      }

      await contact.destroy();
      res.status(200).json({ message: 'Contact message deleted successfully.' });
    } catch (error) {
      console.error('Delete contact error:', error.message);
      res.status(500).json({ error: 'Failed to delete contact message.' });
    }
  }
}

module.exports = new ContactController();
