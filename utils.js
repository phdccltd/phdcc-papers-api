const logger = require('./logger')

//////////////////////
// Report error but don't call next
function exterminate(req, res, err) {
  logger.log("EXTERMINATE", err)
  res.status(200).json({ ret: 1, status: err.message })
  return false;
}

//////////////////////
// Report error but don't call next
function giveup(req, res, msg) {
  logger.log('GIVEUP', msg)
  res.status(200).json({ ret: 1, status: msg })
  return false
}


function async_mail(app, toEmail, subject, message) {
  const transporter = app.get('transporter')
  if (!transporter) {
    logger.log('No transport to send mail')
    return
  }
  const site = app.get('sites')[0]
  const params = {
    from: site.settings['email-from'],
    to: toEmail,
    subject: subject,
    text: message
  }
  params.replyTo = toEmail
  //if (bccEmail) params.bcc = bccEmail

  transporter.sendMail(params, (err, info) => {
    if (err) {
      logger.log("Send mail fail", subject, err);
      return;
    }
    logger.log("Sent mail OK", subject, info)
  })

}
module.exports = {
  exterminate,
  giveup,
  async_mail
}
