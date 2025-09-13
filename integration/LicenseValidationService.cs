using System;
using System.Collections.Generic;
using System.Management;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace GameloopLauncher.Services
{
    /// <summary>
    /// Professional License Validation Service
    /// خدمة التحقق من الترخيص الاحترافية
    /// </summary>
    public class LicenseValidationService
    {
        private const string LICENSE_API_BASE = "https://raw.githubusercontent.com/darkcyberx/gameloop-license-system/main";
        private const string GITHUB_TOKEN = "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";
        private const string DEVICE_SALT = "GameloopLauncher2025-SecureSalt-XYZ789";
        
        private readonly HttpClient _httpClient;
        private string _cachedDeviceId;
        private LicenseInfo _cachedLicenseInfo;
        
        public event Action<string> StatusChanged;
        public event Action<bool> LicenseStatusChanged;
        
        public LicenseValidationService()
        {
            _httpClient = new HttpClient();
            _httpClient.DefaultRequestHeaders.Add("Authorization", $"token {GITHUB_TOKEN}");
            _httpClient.DefaultRequestHeaders.Add("User-Agent", "GameloopLauncher-LicenseSystem/1.0");
            _httpClient.DefaultRequestHeaders.Add("Accept", "application/vnd.github.v3.raw");
            _httpClient.Timeout = TimeSpan.FromSeconds(30);
        }
        
        #region Device Fingerprinting
        
        /// <summary>
        /// Generate unique device fingerprint
        /// إنشاء بصمة فريدة للجهاز
        /// </summary>
        public string GenerateDeviceId()
        {
            if (!string.IsNullOrEmpty(_cachedDeviceId))
                return _cachedDeviceId;
                
            try
            {
                var components = new List<string>();
                
                // Motherboard Serial
                components.Add(GetWMIValue("Win32_BaseBoard", "SerialNumber") ?? "UNKNOWN-MB");
                
                // CPU ID
                components.Add(GetWMIValue("Win32_Processor", "ProcessorId") ?? "UNKNOWN-CPU");
                
                // Primary Disk Serial
                components.Add(GetWMIValue("Win32_DiskDrive", "SerialNumber") ?? "UNKNOWN-DISK");
                
                // Primary MAC Address
                components.Add(GetWMIValue("Win32_NetworkAdapterConfiguration", "MACAddress", "IPEnabled=True") ?? "UNKNOWN-MAC");
                
                // Windows Product ID
                components.Add(GetRegistryValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows NT\CurrentVersion", "ProductId") ?? "UNKNOWN-WIN");
                
                var combined = string.Join("|", components);
                var hash = ComputeSHA256Hash(combined + DEVICE_SALT);
                
                _cachedDeviceId = $"HWID-{hash.Substring(0, 8)}-{hash.Substring(8, 8)}-{hash.Substring(16, 8)}-{hash.Substring(24, 8)}";
                
                LoggingService.LogInfo($"Device ID generated: {_cachedDeviceId}");
                return _cachedDeviceId;
            }
            catch (Exception ex)
            {
                LoggingService.LogError("Failed to generate device ID", ex);
                return "HWID-ERROR-ERROR-ERROR-ERROR";
            }
        }
        
        private string GetWMIValue(string className, string propertyName, string condition = null)
        {
            try
            {
                var query = $"SELECT {propertyName} FROM {className}";
                if (!string.IsNullOrEmpty(condition))
                    query += $" WHERE {condition}";
                    
                using (var searcher = new ManagementObjectSearcher(query))
                using (var collection = searcher.Get())
                {
                    foreach (ManagementObject obj in collection)
                    {
                        var value = obj[propertyName]?.ToString()?.Trim();
                        if (!string.IsNullOrEmpty(value) && value != "To Be Filled By O.E.M.")
                            return value;
                    }
                }
            }
            catch (Exception ex)
            {
                LoggingService.LogDebug($"Failed to get WMI value {className}.{propertyName}: {ex.Message}");
            }
            return null;
        }
        
        private string GetRegistryValue(string keyPath, string valueName)
        {
            try
            {
                using (var key = Registry.LocalMachine.OpenSubKey(keyPath.Replace("HKEY_LOCAL_MACHINE\\", "")))
                {
                    return key?.GetValue(valueName)?.ToString();
                }
            }
            catch (Exception ex)
            {
                LoggingService.LogDebug($"Failed to get registry value {keyPath}\\{valueName}: {ex.Message}");
                return null;
            }
        }
        
        private string ComputeSHA256Hash(string input)
        {
            using (var sha256 = SHA256.Create())
            {
                var bytes = Encoding.UTF8.GetBytes(input);
                var hash = sha256.ComputeHash(bytes);
                return BitConverter.ToString(hash).Replace("-", "").ToLower();
            }
        }
        
        #endregion
        
        #region License Validation
        
        /// <summary>
        /// Validate license key and device binding
        /// التحقق من مفتاح الترخيص وربط الجهاز
        /// </summary>
        public async Task<LicenseValidationResult> ValidateLicenseAsync(string licenseKey)
        {
            try
            {
                StatusChanged?.Invoke("🔍 Validating license key...");
                
                if (string.IsNullOrEmpty(licenseKey))
                    return new LicenseValidationResult { IsValid = false, ErrorMessage = "License key is required" };
                
                // Validate license key format
                if (!IsValidLicenseKeyFormat(licenseKey))
                    return new LicenseValidationResult { IsValid = false, ErrorMessage = "Invalid license key format" };
                
                // Get device ID
                var deviceId = GenerateDeviceId();
                
                // Fetch license database
                StatusChanged?.Invoke("🌐 Checking license database...");
                var licenseDatabase = await FetchLicenseDatabaseAsync();
                
                if (licenseDatabase?.LicenseKeys == null)
                    return new LicenseValidationResult { IsValid = false, ErrorMessage = "Unable to connect to license server" };
                
                // Check if license exists
                if (!licenseDatabase.LicenseKeys.ContainsKey(licenseKey))
                    return new LicenseValidationResult { IsValid = false, ErrorMessage = "License key not found" };
                
                var license = licenseDatabase.LicenseKeys[licenseKey];
                
                // Check license status
                if (license.Status != "active")
                    return new LicenseValidationResult { IsValid = false, ErrorMessage = $"License is {license.Status}" };
                
                // Check expiration
                if (DateTime.TryParse(license.ExpiryDate, out var expiryDate) && expiryDate < DateTime.UtcNow)
                    return new LicenseValidationResult { IsValid = false, ErrorMessage = "License has expired" };
                
                // Check device binding
                var deviceStatus = CheckDeviceBinding(license, deviceId);
                
                if (deviceStatus == DeviceBindingStatus.Authorized)
                {
                    _cachedLicenseInfo = new LicenseInfo
                    {
                        LicenseKey = licenseKey,
                        LicenseType = license.LicenseType,
                        ExpiryDate = expiryDate,
                        FeaturesEnabled = license.FeaturesEnabled,
                        MaxDevices = license.MaxDevices,
                        CurrentDevices = license.CurrentDevices
                    };
                    
                    StatusChanged?.Invoke($"✅ License valid - {license.LicenseType} ({license.DaysRemaining} days remaining)");
                    LicenseStatusChanged?.Invoke(true);
                    
                    return new LicenseValidationResult
                    {
                        IsValid = true,
                        LicenseInfo = _cachedLicenseInfo,
                        DeviceStatus = deviceStatus,
                        Message = "License validated successfully"
                    };
                }
                else if (deviceStatus == DeviceBindingStatus.CanActivate)
                {
                    // Attempt device activation
                    StatusChanged?.Invoke("🔗 Activating device...");
                    var activationResult = await ActivateDeviceAsync(licenseKey, deviceId);
                    
                    if (activationResult.Success)
                    {
                        return await ValidateLicenseAsync(licenseKey); // Re-validate after activation
                    }
                    else
                    {
                        return new LicenseValidationResult { IsValid = false, ErrorMessage = activationResult.ErrorMessage };
                    }
                }
                else
                {
                    return new LicenseValidationResult { IsValid = false, ErrorMessage = GetDeviceStatusMessage(deviceStatus) };
                }
            }
            catch (Exception ex)
            {
                LoggingService.LogError("License validation failed", ex);
                StatusChanged?.Invoke($"❌ License validation error: {ex.Message}");
                return new LicenseValidationResult { IsValid = false, ErrorMessage = $"Validation error: {ex.Message}" };
            }
        }
        
        private bool IsValidLicenseKeyFormat(string licenseKey)
        {
            // Format: GL-TYPE-YEAR-PART1-PART2-CHECKSUM (29 characters)
            if (string.IsNullOrEmpty(licenseKey) || licenseKey.Length != 29)
                return false;
                
            var parts = licenseKey.Split('-');
            if (parts.Length != 6)
                return false;
                
            if (parts[0] != "GL")
                return false;
                
            var validTypes = new[] { "DEMO", "BASIC", "PRO", "ENTERPRISE" };
            if (!validTypes.Contains(parts[1]))
                return false;
                
            if (!int.TryParse(parts[2], out var year) || year < 2025 || year > 2030)
                return false;
                
            return true;
        }
        
        private async Task<LicenseDatabase> FetchLicenseDatabaseAsync()
        {
            try
            {
                var url = $"{LICENSE_API_BASE}/database/licenses.json?t={DateTime.UtcNow.Ticks}";
                var response = await _httpClient.GetStringAsync(url);
                
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                return JsonSerializer.Deserialize<LicenseDatabase>(response, options);
            }
            catch (Exception ex)
            {
                LoggingService.LogError("Failed to fetch license database", ex);
                return null;
            }
        }
        
        private DeviceBindingStatus CheckDeviceBinding(LicenseRecord license, string deviceId)
        {
            // Check if device is already bound
            if (license.DeviceBindings != null && license.DeviceBindings.ContainsKey(deviceId))
            {
                var device = license.DeviceBindings[deviceId];
                return device.Status == "active" ? DeviceBindingStatus.Authorized : DeviceBindingStatus.Deactivated;
            }
            
            // Check if can activate new device
            if (license.CurrentDevices < license.MaxDevices)
                return DeviceBindingStatus.CanActivate;
                
            return DeviceBindingStatus.DeviceLimitExceeded;
        }
        
        private async Task<DeviceActivationResult> ActivateDeviceAsync(string licenseKey, string deviceId)
        {
            try
            {
                // In a real implementation, this would make an API call to activate the device
                // For now, we'll simulate success
                await Task.Delay(1000); // Simulate API call
                
                return new DeviceActivationResult
                {
                    Success = true,
                    Message = "Device activated successfully"
                };
            }
            catch (Exception ex)
            {
                LoggingService.LogError("Device activation failed", ex);
                return new DeviceActivationResult
                {
                    Success = false,
                    ErrorMessage = $"Activation failed: {ex.Message}"
                };
            }
        }
        
        private string GetDeviceStatusMessage(DeviceBindingStatus status)
        {
            return status switch
            {
                DeviceBindingStatus.Authorized => "Device is authorized",
                DeviceBindingStatus.CanActivate => "Device can be activated",
                DeviceBindingStatus.DeviceLimitExceeded => "Maximum number of devices reached for this license",
                DeviceBindingStatus.Deactivated => "Device has been deactivated",
                DeviceBindingStatus.Blacklisted => "Device is blacklisted",
                _ => "Unknown device status"
            };
        }
        
        #endregion
        
        #region Public Methods
        
        /// <summary>
        /// Check if application is licensed and authorized
        /// التحقق من ترخيص وتفويض التطبيق
        /// </summary>
        public bool IsLicensed()
        {
            return _cachedLicenseInfo != null && _cachedLicenseInfo.ExpiryDate > DateTime.UtcNow;
        }
        
        /// <summary>
        /// Get current license information
        /// الحصول على معلومات الترخيص الحالي
        /// </summary>
        public LicenseInfo GetLicenseInfo()
        {
            return _cachedLicenseInfo;
        }
        
        /// <summary>
        /// Check if specific feature is enabled
        /// التحقق من تفعيل ميزة معينة
        /// </summary>
        public bool IsFeatureEnabled(string featureName)
        {
            return _cachedLicenseInfo?.FeaturesEnabled?.Contains(featureName) == true;
        }
        
        /// <summary>
        /// Get days remaining until license expiry
        /// الحصول على الأيام المتبقية قبل انتهاء الترخيص
        /// </summary>
        public int GetDaysRemaining()
        {
            if (_cachedLicenseInfo?.ExpiryDate == null)
                return 0;
                
            var remaining = _cachedLicenseInfo.ExpiryDate.Value.Subtract(DateTime.UtcNow).Days;
            return Math.Max(0, remaining);
        }
        
        /// <summary>
        /// Clear cached license information
        /// مسح معلومات الترخيص المحفوظة
        /// </summary>
        public void ClearLicenseCache()
        {
            _cachedLicenseInfo = null;
            _cachedDeviceId = null;
            LicenseStatusChanged?.Invoke(false);
        }
        
        #endregion
        
        #region Data Models
        
        public class LicenseValidationResult
        {
            public bool IsValid { get; set; }
            public LicenseInfo LicenseInfo { get; set; }
            public DeviceBindingStatus DeviceStatus { get; set; }
            public string Message { get; set; }
            public string ErrorMessage { get; set; }
        }
        
        public class LicenseInfo
        {
            public string LicenseKey { get; set; }
            public string LicenseType { get; set; }
            public DateTime? ExpiryDate { get; set; }
            public List<string> FeaturesEnabled { get; set; }
            public int MaxDevices { get; set; }
            public int CurrentDevices { get; set; }
        }
        
        public class DeviceActivationResult
        {
            public bool Success { get; set; }
            public string Message { get; set; }
            public string ErrorMessage { get; set; }
        }
        
        public enum DeviceBindingStatus
        {
            Authorized,
            CanActivate,
            DeviceLimitExceeded,
            Deactivated,
            Blacklisted
        }
        
        // Database models (simplified for integration)
        public class LicenseDatabase
        {
            public Dictionary<string, LicenseRecord> LicenseKeys { get; set; }
        }
        
        public class LicenseRecord
        {
            public string Status { get; set; }
            public string ExpiryDate { get; set; }
            public string LicenseType { get; set; }
            public int MaxDevices { get; set; }
            public int CurrentDevices { get; set; }
            public int DaysRemaining { get; set; }
            public List<string> FeaturesEnabled { get; set; }
            public Dictionary<string, DeviceBinding> DeviceBindings { get; set; }
        }
        
        public class DeviceBinding
        {
            public string Status { get; set; }
            public string DeviceName { get; set; }
            public string FirstActivation { get; set; }
            public string LastSeen { get; set; }
        }
        
        #endregion
        
        public void Dispose()
        {
            _httpClient?.Dispose();
        }
    }
}