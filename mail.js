const nodemailer = require('nodemailer');
const smtpConfig = require('./config').smtp

module.exports = {
  send: (msg) => {
    const transporter = nodemailer.createTransport(smtpConfig);

    return new Promise((resolve, reject) => {
      transporter
        .sendMail(msg)
        .then(async (info) => {
          if (smtpConfig.host === 'smtp.ethereal.email') {
            console.info('Message sent: %s', info.messageId);
            // Preview only available when sending through an Ethereal account
            console.info('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            resolve(nodemailer.getTestMessageUrl(info));
          }
          resolve(info)
        }).catch(reject)
    })
  }
}