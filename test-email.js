#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function testEmailFormat() {
  try {
    // Find the latest generated HTML file
    const outputDir = path.join(process.cwd(), 'output');
    const files = await fs.readdir(outputDir);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    
    if (htmlFiles.length === 0) {
      console.log('❌ No HTML files found. Run npm run dev first.');
      return;
    }
    
    const latestFile = htmlFiles.sort().pop();
    const filePath = path.join(outputDir, latestFile);
    
    console.log(`📧 Testing email format for: ${latestFile}`);
    console.log('='.repeat(50));
    
    // Read the HTML content
    const htmlContent = await fs.readFile(filePath, 'utf8');
    
    // Basic HTML validation
    const checks = [
      { test: htmlContent.trim().startsWith('<!DOCTYPE html'), name: 'DOCTYPE declaration' },
      { test: htmlContent.includes('<html'), name: 'HTML tag' },
      { test: htmlContent.includes('<head>'), name: 'HEAD section' },
      { test: htmlContent.includes('<body>'), name: 'BODY section' },
      { test: htmlContent.includes('</html>'), name: 'HTML closing tag' },
      { test: htmlContent.includes('style'), name: 'CSS styles' },
      { test: htmlContent.length > 1000, name: 'Reasonable content length' }
    ];
    
    console.log('🔍 HTML Structure Validation:');
    checks.forEach(check => {
      console.log(`  ${check.test ? '✅' : '❌'} ${check.name}`);
    });
    
    console.log('\n📊 Content Analysis:');
    console.log(`  File size: ${htmlContent.length} characters`);
    console.log(`  Line count: ${htmlContent.split('\n').length} lines`);
    
    // Show first and last few lines
    const lines = htmlContent.split('\n');
    console.log('\n🔼 First 5 lines:');
    lines.slice(0, 5).forEach((line, i) => {
      console.log(`  ${i + 1}: ${line}`);
    });
    
    console.log('\n🔽 Last 5 lines:');
    lines.slice(-5).forEach((line, i) => {
      console.log(`  ${lines.length - 4 + i}: ${line}`);
    });
    
    // Test base64 encoding/decoding (simulating GitHub Action)
    console.log('\n🔄 Testing base64 encoding/decoding:');
    const encoded = Buffer.from(htmlContent).toString('base64');
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const matches = decoded === htmlContent;
    console.log(`  ${matches ? '✅' : '❌'} Base64 round-trip successful`);
    
    if (matches) {
      console.log('\n🎉 HTML email format looks good!');
      console.log('💡 If emails still show as plain text, check:');
      console.log('   1. Email client HTML rendering settings');
      console.log('   2. SMTP server configuration');
      console.log('   3. Email headers (Content-Type)');
    } else {
      console.log('\n❌ Base64 encoding issue detected');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  testEmailFormat();
}

module.exports = testEmailFormat;