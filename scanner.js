var os = require('os');
var ping = require('ping');
var arp = require('node-arp');
var inquirer = require('inquirer');

var RPI_MAC_PREFIXES = ['b8:27:eb', 'dc:a6:32', 'e4:5f:01', 'dc:44:6d'];

function getAvailableSubnets() {
  const interfaces = os.networkInterfaces();
  const seen = new Set();
  const subnets = [];

  for (const name in interfaces) {
    interfaces[name].forEach((iface) => {
      if (!iface.internal && iface.family === 'IPv4') {
        const subnet = iface.address.split('.').slice(0, 3).join('.');
        const label = `${subnet}.0/24 (${name})`;

        // Avoid duplicates
        if (!seen.has(subnet)) {
          subnets.push({ name: label, value: subnet });
          seen.add(subnet);
        }
      }
    });
  }

  if (subnets.length === 0) {
    throw new Error('No active IPv4 network interfaces found.');
  }

  return subnets;
}

function scanNetwork(subnet, callback) {
  var liveHosts = [];
  var pending = 0;

  for (var i = 1; i <= 254; i++) {
    (function (i) {
      var ip = subnet + '.' + i;
      pending++;
      ping.sys.probe(ip, function (isAlive) {
        if (isAlive) {
          liveHosts.push(ip);
        }
        pending--;
        if (pending === 0) {
          callback(liveHosts);
        }
      });
    })(i);
  }
}

function isRaspberryPi(mac) {
  mac = mac.toLowerCase();
  return RPI_MAC_PREFIXES.some(function (prefix) {
    return mac.indexOf(prefix) === 0;
  });
}

function checkMACAddresses(hosts) {
  hosts.forEach(function (host) {
    arp.getMAC(host, function (err, mac) {
      if (!err && mac && isRaspberryPi(mac)) {
        console.log('🎯 Raspberry Pi found at ' + host + ' (MAC: ' + mac + ')');
      }
    });
  });
}

function main() {
  var subnets = getAvailableSubnets();

  inquirer.prompt([
    {
      type: 'list',
      name: 'subnet',
      message: 'Choose a subnet to scan:',
      choices: subnets
    }
  ]).then(function (answers) {
    var subnet = answers.subnet;
    console.log('\n📡 Scanning ' + subnet + '.0/24...');
    scanNetwork(subnet, function (liveHosts) {
      console.log('\n🔎 Found ' + liveHosts.length + ' live hosts. Checking for Raspberry Pi devices...');
      checkMACAddresses(liveHosts);
    });
  });
}

main();
