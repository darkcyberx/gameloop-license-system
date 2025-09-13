# License Management Tools
# أدوات إدارة التراخيص

import json
import hashlib
import random
import string
from datetime import datetime, timedelta
from typing import Dict, List, Optional

class LicenseManager:
    """Professional License Management System"""
    
    def __init__(self, database_path: str = "database/licenses.json"):
        self.database_path = database_path
        self.license_database = self.load_database()
    
    def load_database(self) -> Dict:
        """Load license database from JSON file"""
        try:
            with open(self.database_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            return self.create_empty_database()
    
    def save_database(self) -> bool:
        """Save license database to JSON file"""
        try:
            with open(self.database_path, 'w', encoding='utf-8') as f:
                json.dump(self.license_database, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Error saving database: {e}")
            return False
    
    def create_empty_database(self) -> Dict:
        """Create empty license database structure"""
        return {
            "system_info": {
                "version": "1.0.0",
                "created": datetime.utcnow().isoformat() + "Z",
                "last_updated": datetime.utcnow().isoformat() + "Z",
                "total_licenses": 0,
                "active_licenses": 0,
                "expired_licenses": 0
            },
            "license_keys": {},
            "revoked_licenses": {},
            "blacklisted_devices": {}
        }
    
    def generate_license_key(self, license_type: str, year: int = None) -> str:
        """Generate unique license key with proper format"""
        if year is None:
            year = datetime.now().year
        
        # Validate license type
        valid_types = ["DEMO", "BASIC", "PRO", "ENTERPRISE"]
        if license_type not in valid_types:
            raise ValueError(f"Invalid license type. Must be one of: {valid_types}")
        
        # Generate random parts
        part1 = ''.join(random.choices(string.ascii_uppercase, k=4))
        part2 = ''.join(random.choices(string.ascii_uppercase, k=4))
        
        # Generate checksum
        base_key = f"GL-{license_type}-{year}-{part1}-{part2}"
        checksum = hashlib.md5(base_key.encode()).hexdigest()[:4].upper()
        
        # Final license key
        license_key = f"{base_key}-{checksum}"
        
        # Ensure uniqueness
        while license_key in self.license_database["license_keys"]:
            part1 = ''.join(random.choices(string.ascii_uppercase, k=4))
            part2 = ''.join(random.choices(string.ascii_uppercase, k=4))
            base_key = f"GL-{license_type}-{year}-{part1}-{part2}"
            checksum = hashlib.md5(base_key.encode()).hexdigest()[:4].upper()
            license_key = f"{base_key}-{checksum}"
        
        return license_key
    
    def create_license(self, license_type: str, owner_name: str, owner_email: str, 
                      duration_days: int = None, max_devices: int = None) -> str:
        """Create new license with specified parameters"""
        
        # Default values based on license type
        defaults = {
            "DEMO": {"duration": 7, "devices": 1},
            "BASIC": {"duration": 30, "devices": 3},
            "PRO": {"duration": 365, "devices": 5},
            "ENTERPRISE": {"duration": 365, "devices": 10}
        }
        
        if duration_days is None:
            duration_days = defaults[license_type]["duration"]
        if max_devices is None:
            max_devices = defaults[license_type]["devices"]
        
        # Generate license key
        license_key = self.generate_license_key(license_type)
        
        # Calculate dates
        created_date = datetime.utcnow()
        expiry_date = created_date + timedelta(days=duration_days)
        
        # Create license record
        license_record = {
            "license_key": license_key,
            "status": "active",
            "created_date": created_date.isoformat() + "Z",
            "expiry_date": expiry_date.isoformat() + "Z",
            "days_remaining": duration_days,
            "max_devices": max_devices,
            "current_devices": 0,
            "owner_info": {
                "name": owner_name,
                "email": owner_email,
                "registration_date": created_date.isoformat() + "Z"
            },
            "device_bindings": {},
            "usage_statistics": {
                "total_activations": 0,
                "total_launches": 0,
                "last_launch": None,
                "features_used": []
            },
            "license_type": license_type.lower(),
            "features_enabled": self.get_features_for_type(license_type)
        }
        
        # Add to database
        self.license_database["license_keys"][license_key] = license_record
        
        # Update system info
        self.license_database["system_info"]["total_licenses"] += 1
        self.license_database["system_info"]["active_licenses"] += 1
        self.license_database["system_info"]["last_updated"] = datetime.utcnow().isoformat() + "Z"
        
        # Save database
        self.save_database()
        
        print(f"✅ License created successfully:")
        print(f"   License Key: {license_key}")
        print(f"   Type: {license_type}")
        print(f"   Owner: {owner_name} ({owner_email})")
        print(f"   Duration: {duration_days} days")
        print(f"   Max Devices: {max_devices}")
        print(f"   Expires: {expiry_date.strftime('%Y-%m-%d %H:%M:%S')}")
        
        return license_key
    
    def get_features_for_type(self, license_type: str) -> List[str]:
        """Get enabled features for license type"""
        features = {
            "DEMO": ["basic_features"],
            "BASIC": ["pubg_auto_update", "gameloop_management"],
            "PRO": ["pubg_auto_update", "gameloop_management", "registry_tools", "advanced_settings"],
            "ENTERPRISE": ["pubg_auto_update", "gameloop_management", "registry_tools", 
                          "advanced_settings", "priority_support", "bulk_operations"]
        }
        return features.get(license_type, [])
    
    def revoke_license(self, license_key: str, reason: str = "License violation") -> bool:
        """Revoke a license key"""
        if license_key not in self.license_database["license_keys"]:
            print(f"❌ License key not found: {license_key}")
            return False
        
        # Move to revoked licenses
        license_record = self.license_database["license_keys"][license_key]
        self.license_database["revoked_licenses"][license_key] = {
            "license_key": license_key,
            "revoked_date": datetime.utcnow().isoformat() + "Z",
            "revoke_reason": reason,
            "original_expiry": license_record["expiry_date"]
        }
        
        # Remove from active licenses
        del self.license_database["license_keys"][license_key]
        
        # Update system info
        self.license_database["system_info"]["active_licenses"] -= 1
        self.license_database["system_info"]["last_updated"] = datetime.utcnow().isoformat() + "Z"
        
        self.save_database()
        print(f"✅ License revoked: {license_key}")
        print(f"   Reason: {reason}")
        return True
    
    def extend_license(self, license_key: str, additional_days: int) -> bool:
        """Extend license expiration date"""
        if license_key not in self.license_database["license_keys"]:
            print(f"❌ License key not found: {license_key}")
            return False
        
        license_record = self.license_database["license_keys"][license_key]
        current_expiry = datetime.fromisoformat(license_record["expiry_date"].replace("Z", ""))
        new_expiry = current_expiry + timedelta(days=additional_days)
        
        license_record["expiry_date"] = new_expiry.isoformat() + "Z"
        license_record["days_remaining"] = (new_expiry - datetime.utcnow()).days
        
        self.license_database["system_info"]["last_updated"] = datetime.utcnow().isoformat() + "Z"
        
        self.save_database()
        print(f"✅ License extended: {license_key}")
        print(f"   Additional days: {additional_days}")
        print(f"   New expiry: {new_expiry.strftime('%Y-%m-%d %H:%M:%S')}")
        return True
    
    def blacklist_device(self, device_id: str, reason: str = "Multiple violations") -> bool:
        """Add device to blacklist"""
        self.license_database["blacklisted_devices"][device_id] = {
            "device_id": device_id,
            "blacklist_date": datetime.utcnow().isoformat() + "Z",
            "reason": reason,
            "permanent": True
        }
        
        self.save_database()
        print(f"✅ Device blacklisted: {device_id}")
        print(f"   Reason: {reason}")
        return True
    
    def get_license_info(self, license_key: str) -> Optional[Dict]:
        """Get detailed license information"""
        if license_key in self.license_database["license_keys"]:
            return self.license_database["license_keys"][license_key]
        elif license_key in self.license_database["revoked_licenses"]:
            return self.license_database["revoked_licenses"][license_key]
        return None
    
    def list_all_licenses(self) -> None:
        """List all licenses with summary"""
        active_licenses = self.license_database["license_keys"]
        revoked_licenses = self.license_database["revoked_licenses"]
        
        print("🔑 LICENSE SYSTEM SUMMARY")
        print("=" * 50)
        print(f"Total Licenses: {len(active_licenses) + len(revoked_licenses)}")
        print(f"Active Licenses: {len(active_licenses)}")
        print(f"Revoked Licenses: {len(revoked_licenses)}")
        print()
        
        if active_licenses:
            print("📋 ACTIVE LICENSES:")
            print("-" * 30)
            for key, license_data in active_licenses.items():
                expiry = datetime.fromisoformat(license_data["expiry_date"].replace("Z", ""))
                days_left = (expiry - datetime.utcnow()).days
                status = "🟢 Active" if days_left > 0 else "🔴 Expired"
                
                print(f"Key: {key}")
                print(f"Type: {license_data['license_type'].upper()}")
                print(f"Owner: {license_data['owner_info']['name']}")
                print(f"Devices: {license_data['current_devices']}/{license_data['max_devices']}")
                print(f"Status: {status} ({days_left} days left)")
                print()
        
        if revoked_licenses:
            print("❌ REVOKED LICENSES:")
            print("-" * 30)
            for key, revoked_data in revoked_licenses.items():
                print(f"Key: {key}")
                print(f"Revoked: {revoked_data['revoked_date']}")
                print(f"Reason: {revoked_data['revoke_reason']}")
                print()

def main():
    """Example usage of License Manager"""
    manager = LicenseManager()
    
    print("🎯 GAMELOOP LICENSE MANAGEMENT SYSTEM")
    print("=" * 50)
    
    # Create sample licenses
    print("\n1. Creating sample licenses...")
    
    # Demo license
    demo_key = manager.create_license("DEMO", "Demo User", "demo@example.com")
    
    # Basic license
    basic_key = manager.create_license("BASIC", "Basic User", "basic@example.com")
    
    # Pro license
    pro_key = manager.create_license("PRO", "Pro User", "pro@example.com")
    
    # Enterprise license
    enterprise_key = manager.create_license("ENTERPRISE", "Enterprise User", "enterprise@example.com")
    
    print("\n2. License system summary:")
    manager.list_all_licenses()
    
    print("\n3. Example operations:")
    
    # Extend a license
    print("\n   Extending Pro license by 90 days...")
    manager.extend_license(pro_key, 90)
    
    # Blacklist a device
    print("\n   Blacklisting a problem device...")
    manager.blacklist_device("HWID-PROBLEM-DEVICE-1234-5678", "License sharing violation")
    
    print("\n✅ License management system ready!")
    print(f"📁 Database saved to: {manager.database_path}")
    print("\n🔗 GitHub Repository: https://github.com/darkcyberx/gameloop-license-system")

if __name__ == "__main__":
    main()