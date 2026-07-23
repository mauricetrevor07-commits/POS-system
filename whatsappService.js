const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

class WhatsAppService {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        this.qrCodeUrl = null;
        this.isConnected = false;

        this.client.on('qr', async (qr) => {
            try {
                this.qrCodeUrl = await qrcode.toDataURL(qr);
                console.log('WhatsApp QR Code generated. Awaiting scan...');
            } catch (err) {
                console.error('Failed to generate QR code URL:', err);
            }
        });

        this.client.on('ready', () => {
            console.log('WhatsApp Client is ready!');
            this.isConnected = true;
            this.qrCodeUrl = null;
        });

        this.client.on('disconnected', (reason) => {
            console.log('WhatsApp Client was disconnected', reason);
            this.isConnected = false;
        });

        this.client.on('auth_failure', msg => {
            console.error('WhatsApp AUTH FAILURE', msg);
            this.isConnected = false;
        });
    }

    initialize() {
        console.log('Initializing WhatsApp Client...');
        this.client.initialize().catch(err => {
            console.error('Error initializing WhatsApp Client:', err);
        });
    }

    getQrCode() {
        return this.qrCodeUrl;
    }

    getStatus() {
        return { isConnected: this.isConnected };
    }

    async sendMessage(phone, message) {
        if (!this.isConnected) {
            console.log('WhatsApp is not connected. Cannot send message.');
            return false;
        }

        try {
            // Format phone number to the correct ID (e.g., 254700000000@c.us)
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            const chatId = `${cleanPhone}@c.us`;
            
            await this.client.sendMessage(chatId, message);
            return true;
        } catch (err) {
            console.error('Failed to send WhatsApp message:', err);
            return false;
        }
    }
}

module.exports = new WhatsAppService();
