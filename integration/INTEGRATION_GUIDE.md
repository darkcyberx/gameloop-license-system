# Gameloop Launcher License Integration Guide
## دليل تكامل نظام الترخيص مع Gameloop Launcher

This guide shows how to integrate the professional license system into your Gameloop Launcher application.

---

## 🔧 Integration Steps - خطوات التكامل

### Step 1: Add License Service to Project
Copy the `LicenseValidationService.cs` file to your Gameloop Launcher project:

```csharp
// Path: GameloopLauncher/Services/LicenseValidationService.cs
```

### Step 2: Add Required NuGet Packages
Add these packages to your project:

```xml
<PackageReference Include="System.Management" Version="7.0.0" />
<PackageReference Include="System.Text.Json" Version="7.0.0" />
```

### Step 3: Update MainForm Constructor
Add license initialization to your MainForm:

```csharp
public partial class MainForm : Form
{
    private readonly LicenseValidationService _licenseService;
    private bool _isLicensed = false;
    
    public MainForm()
    {
        // ... existing code ...
        
        // Initialize license service
        _licenseService = new LicenseValidationService();
        _licenseService.StatusChanged += OnLicenseStatusChanged;
        _licenseService.LicenseStatusChanged += OnLicenseValidationChanged;
        
        InitializeComponent();
        
        // Check license on startup
        _ = CheckLicenseOnStartup();
    }
}
```

### Step 4: Add License Check Method
```csharp
private async Task CheckLicenseOnStartup()
{
    try
    {
        StatusChanged?.Invoke("🔍 Checking software license...");
        
        // Try to load saved license key
        var savedLicense = LoadSavedLicenseKey();
        
        if (!string.IsNullOrEmpty(savedLicense))
        {
            var result = await _licenseService.ValidateLicenseAsync(savedLicense);
            if (result.IsValid)
            {
                _isLicensed = true;
                EnableAllFeatures();
                StatusChanged?.Invoke($"✅ Licensed - {result.LicenseInfo.LicenseType} ({_licenseService.GetDaysRemaining()} days remaining)");
                return;
            }
        }
        
        // Show license activation dialog
        ShowLicenseActivationDialog();
    }
    catch (Exception ex)
    {
        LoggingService.LogError("License check failed", ex);
        ShowLicenseActivationDialog();
    }
}

private void ShowLicenseActivationDialog()
{
    var licenseForm = new LicenseActivationForm(_licenseService);
    var result = licenseForm.ShowDialog(this);
    
    if (result == DialogResult.OK && licenseForm.IsActivated)
    {
        _isLicensed = true;
        EnableAllFeatures();
        SaveLicenseKey(licenseForm.LicenseKey);
    }
    else
    {
        _isLicensed = false;
        EnableDemoFeatures();
    }
}
```

### Step 5: Feature Control Based on License
```csharp
private void EnableAllFeatures()
{
    btnPubgUpdate.Enabled = _licenseService.IsFeatureEnabled("pubg_auto_update");
    btnEmulatorUpdate.Enabled = _licenseService.IsFeatureEnabled("gameloop_management");
    btnRegUpdate.Enabled = _licenseService.IsFeatureEnabled("registry_tools");
    // ... enable other features based on license type
}

private void EnableDemoFeatures()
{
    // Disable premium features for unlicensed users
    btnPubgUpdate.Enabled = false;
    btnEmulatorUpdate.Enabled = false;
    btnRegUpdate.Enabled = true; // Basic feature allowed
    
    // Show demo limitations
    StatusChanged?.Invoke("⚠️ Demo mode - Some features are disabled. Please activate license.");
}
```

### Step 6: Protect PUBG Update Feature
Update your PUBG update method to check license:

```csharp
private async void BtnPubgUpdate_Click(object sender, EventArgs e)
{
    if (!_isLicensed || !_licenseService.IsFeatureEnabled("pubg_auto_update"))
    {
        MessageBox.Show(
            "🔒 PUBG Auto Update requires a valid license.\n" +
            "Please activate your license to use this feature.\n\n" +
            "🔒 تحديث PUBG التلقائي يتطلب ترخيص صالح.\n" +
            "يرجى تفعيل الترخيص لاستخدام هذه الميزة.",
            "License Required - ترخيص مطلوب",
            MessageBoxButtons.OK, MessageBoxIcon.Warning);
        
        ShowLicenseActivationDialog();
        return;
    }
    
    // Proceed with normal PUBG update
    await ExecuteWithProgress("PUBG Update", async () => 
    {
        await _pubgUpdateService.SimpleDirectDownloadAsync();
    });
}
```

---

## 🎯 License Activation Form Example

Create a new form for license activation:

```csharp
public partial class LicenseActivationForm : Form
{
    private readonly LicenseValidationService _licenseService;
    public bool IsActivated { get; private set; }
    public string LicenseKey { get; private set; }
    
    private TextBox txtLicenseKey;
    private Button btnActivate;
    private Button btnCancel;
    private Label lblStatus;
    private ProgressBar progressBar;
    
    public LicenseActivationForm(LicenseValidationService licenseService)
    {
        _licenseService = licenseService;
        InitializeComponent();
    }
    
    private void InitializeComponent()
    {
        this.Text = "Software License Activation - تفعيل ترخيص البرنامج";
        this.Size = new Size(500, 300);
        this.StartPosition = FormStartPosition.CenterParent;
        this.FormBorderStyle = FormBorderStyle.FixedDialog;
        
        // License key input
        var lblPrompt = new Label
        {
            Text = "Enter your license key:\nأدخل مفتاح الترخيص:",
            Location = new Point(20, 20),
            Size = new Size(450, 40),
            Font = new Font("Segoe UI", 10)
        };
        
        txtLicenseKey = new TextBox
        {
            Location = new Point(20, 70),
            Size = new Size(450, 25),
            Font = new Font("Consolas", 11),
            PlaceholderText = "GL-TYPE-YEAR-XXXX-YYYY-ZZZZ"
        };
        
        btnActivate = new Button
        {
            Text = "🔑 Activate License - تفعيل الترخيص",
            Location = new Point(20, 120),
            Size = new Size(200, 40),
            BackColor = Color.FromArgb(46, 204, 113),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat
        };
        btnActivate.Click += BtnActivate_Click;
        
        btnCancel = new Button
        {
            Text = "❌ Cancel - إلغاء",
            Location = new Point(250, 120),
            Size = new Size(100, 40),
            BackColor = Color.FromArgb(231, 76, 60),
            ForeColor = Color.White,
            FlatStyle = FlatStyle.Flat
        };
        btnCancel.Click += (s, e) => { DialogResult = DialogResult.Cancel; Close(); };
        
        lblStatus = new Label
        {
            Location = new Point(20, 180),
            Size = new Size(450, 60),
            Font = new Font("Segoe UI", 9),
            ForeColor = Color.Gray
        };
        
        progressBar = new ProgressBar
        {
            Location = new Point(20, 250),
            Size = new Size(450, 10),
            Style = ProgressBarStyle.Marquee,
            Visible = false
        };
        
        this.Controls.AddRange(new Control[] { 
            lblPrompt, txtLicenseKey, btnActivate, btnCancel, lblStatus, progressBar 
        });
    }
    
    private async void BtnActivate_Click(object sender, EventArgs e)
    {
        var licenseKey = txtLicenseKey.Text.Trim().ToUpper();
        
        if (string.IsNullOrEmpty(licenseKey))
        {
            lblStatus.Text = "⚠️ Please enter a license key";
            lblStatus.ForeColor = Color.Orange;
            return;
        }
        
        try
        {
            btnActivate.Enabled = false;
            progressBar.Visible = true;
            lblStatus.Text = "🔍 Validating license...";
            lblStatus.ForeColor = Color.Blue;
            
            var result = await _licenseService.ValidateLicenseAsync(licenseKey);
            
            if (result.IsValid)
            {
                IsActivated = true;
                LicenseKey = licenseKey;
                lblStatus.Text = $"✅ License activated successfully!\nType: {result.LicenseInfo.LicenseType}\nExpires in: {_licenseService.GetDaysRemaining()} days";
                lblStatus.ForeColor = Color.Green;
                
                await Task.Delay(2000);
                DialogResult = DialogResult.OK;
                Close();
            }
            else
            {
                lblStatus.Text = $"❌ License validation failed:\n{result.ErrorMessage}";
                lblStatus.ForeColor = Color.Red;
            }
        }
        catch (Exception ex)
        {
            lblStatus.Text = $"❌ Activation error:\n{ex.Message}";
            lblStatus.ForeColor = Color.Red;
        }
        finally
        {
            btnActivate.Enabled = true;
            progressBar.Visible = false;
        }
    }
}
```

---

## 💾 License Storage Methods

```csharp
private string LoadSavedLicenseKey()
{
    try
    {
        using (var key = Registry.CurrentUser.CreateSubKey(@"Software\GameloopLauncher\License"))
        {
            var encryptedKey = key?.GetValue("LicenseKey")?.ToString();
            return !string.IsNullOrEmpty(encryptedKey) ? DecryptString(encryptedKey) : null;
        }
    }
    catch (Exception ex)
    {
        LoggingService.LogError("Failed to load saved license", ex);
        return null;
    }
}

private void SaveLicenseKey(string licenseKey)
{
    try
    {
        using (var key = Registry.CurrentUser.CreateSubKey(@"Software\GameloopLauncher\License"))
        {
            var encryptedKey = EncryptString(licenseKey);
            key?.SetValue("LicenseKey", encryptedKey);
            key?.SetValue("ActivatedDate", DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss"));
        }
    }
    catch (Exception ex)
    {
        LoggingService.LogError("Failed to save license", ex);
    }
}

private string EncryptString(string plainText)
{
    // Simple encryption for license storage (implement proper encryption in production)
    var plainTextBytes = Encoding.UTF8.GetBytes(plainText);
    return Convert.ToBase64String(plainTextBytes);
}

private string DecryptString(string cipherText)
{
    try
    {
        var cipherTextBytes = Convert.FromBase64String(cipherText);
        return Encoding.UTF8.GetString(cipherTextBytes);
    }
    catch
    {
        return null;
    }
}
```

---

## 🔒 Security Recommendations

### 1. **Code Obfuscation**
Use tools like ConfuserEx or .NET Reactor to obfuscate your compiled application.

### 2. **Anti-Tampering**
Add integrity checks to prevent modification of license validation code.

### 3. **Secure Communication**
All license API calls use HTTPS and authentication tokens.

### 4. **Local Validation**
Cache license validation results with expiry to reduce API calls.

### 5. **Feature Protection**
Always check license status before executing protected features.

---

## 📊 Usage Analytics

Track license usage for insights:

```csharp
private async Task TrackFeatureUsage(string featureName)
{
    if (_isLicensed)
    {
        // Track feature usage for analytics
        var deviceId = _licenseService.GenerateDeviceId();
        // Log usage to analytics service
        LoggingService.LogInfo($"Feature used: {featureName} by device: {deviceId}");
    }
}
```

---

## 🎉 Integration Complete!

After following these steps, your Gameloop Launcher will have:

✅ **Professional License Protection**  
✅ **Device Binding Security**  
✅ **Feature-Based Access Control**  
✅ **User-Friendly Activation**  
✅ **Automatic License Validation**  
✅ **Multi-Device Support**  
✅ **Time-Based Licensing**  

### 🚀 Ready for Production!

Your application is now protected with a professional license system that provides:
- Secure device binding
- Multi-device support (1-10 devices)
- Time-based licensing (7-365 days)
- Feature-based access control
- Professional activation flow
- Comprehensive error handling

---

## 📞 Support

For integration support:
- **Repository**: [gameloop-license-system](https://github.com/darkcyberx/gameloop-license-system)
- **Documentation**: See README.md for complete API reference
- **Issues**: Report integration issues via GitHub Issues