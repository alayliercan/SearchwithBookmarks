let { Cc, Ci } = require('chrome');

var hashModule = (function () {
	var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter'].createInstance(Ci.nsIScriptableUnicodeConverter);
	converter.charset = 'UTF-8';
  // result is an out parameter,
  // result.value will contain the array length
	var result = {};

	function toHexString (charCode) {
		// return the two-digit hexadecimal code for a byte
		return ('0' + charCode.toString(16)).slice(-2);
	}
	return {
		convert: function (strValue) {
			// data is an array of bytes
			var data = converter.convertToByteArray(strValue, result);
			var ch = Cc['@mozilla.org/security/hash;1'].createInstance(Ci.nsICryptoHash);
			ch.init(ch.SHA256);
			ch.update(data, data.length);
			var hash = ch.finish(false);
			// convert the binary hash data to a hex string.
			return Array.from(hash, (c, i) => toHexString(hash.charCodeAt(i))).join('');
		}
	};
})();

exports.sha256 = hashModule;
