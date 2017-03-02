<?php
/**
 * @copyright Copyright (c) 2017, Afterlogic Corp.
 * @license AGPL-3.0
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License, version 3,
 * as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License, version 3,
 * along with this program.  If not, see <http://www.gnu.org/licenses/>
 * 
 * @package Modules
 */

namespace Aurora\Modules;

class CoreWebclientModule extends \Aurora\System\AbstractModule
{
	/**
	 * Initializes CoreWebclient Module.
	 * 
	 * @ignore
	 */
	public function init() {
		$this->extendObject('CUser', array(
				'AllowDesktopNotifications'		=> array('bool', $this->getConfig('AllowDesktopNotifications', false)),
				'AutoRefreshIntervalMinutes'	=> array('int', $this->getConfig('AutoRefreshIntervalMinutes', 0)),
				'Theme'							=> array('string', $this->getConfig('Theme', 'Default')),
			)
		);
		
		$this->subscribeEvent('Core::UpdateSettings::after', array($this, 'onAfterUpdateSettings'));
	}
	
	private function getLanguageList($aSystemList)
	{
		$aResultList = [];
		$aLanguageNames = $this->getConfig('LanguageNames', false);
		foreach ($aSystemList as $sLanguage) {
			if (isset($aLanguageNames[$sLanguage]))
			{
				$aResultList[] = [
					'name' => $aLanguageNames[$sLanguage],
					'value' => $sLanguage
				];
			}
			else
			{
				$aResultList[] = [
					'name' => $sLanguage,
					'value' => $sLanguage
				];
			}
		}
		return $aResultList;
	}
	
	public function GetSettings()
	{
		\Aurora\System\Api::checkUserRoleIsAtLeast(\EUserRole::Anonymous);
		
		$oUser = \Aurora\System\Api::getAuthenticatedUser();
		$oApiIntegrator = \Aurora\System\Api::GetSystemManager('integrator');
		
		return array(
			'AllowChangeSettings' => $this->getConfig('AllowChangeSettings', false),
			'AllowClientDebug' => $this->getConfig('AllowClientDebug', false),
			'AllowDesktopNotifications' => $oUser ? $oUser->{$this->GetName().'::AllowDesktopNotifications'} : $this->getConfig('AllowDesktopNotifications', false),
			'AllowIosProfile' => $this->getConfig('AllowIosProfile', false),
			'AllowMobile' => $this->getConfig('AllowMobile', false),
			'AllowPrefetch' => $this->getConfig('AllowPrefetch', false),
			'AttachmentSizeLimit' => $this->getConfig('AttachmentSizeLimit', 0),
			'AutoRefreshIntervalMinutes' => $oUser ? $oUser->{$this->GetName().'::AutoRefreshIntervalMinutes'} : $this->getConfig('AutoRefreshIntervalMinutes', 0),
			'CustomLogoutUrl' => $this->getConfig('CustomLogoutUrl', ''),
			'EntryModule' => $this->getConfig('EntryModule', ''),
			'GoogleAnalyticsAccount' => $this->getConfig('GoogleAnalyticsAccount', ''),
			'HeaderModulesOrder' => $this->getConfig('HeaderModulesOrder', []),
			'IsDemo' => $this->getConfig('IsDemo', false),
			'IsMobile' => -1,
			'LanguageListWithNames' => $this->getLanguageList($oApiIntegrator->getLanguageList()),
			'LogoUrl' => $this->getConfig('LogoUrl'),
			'ShowQuotaBar' => $this->getConfig('ShowQuotaBar', false),
			'SyncIosAfterLogin' => $this->getConfig('SyncIosAfterLogin', false),
			'Theme' => $oUser ? $oUser->{$this->GetName().'::Theme'} : $this->getConfig('Theme', 'Default'),
			'ThemeList' => $this->getConfig('ThemeList', ['Default']),
		);
	}
	
	public function onAfterUpdateSettings($Args, &$Result)
	{
		\Aurora\System\Api::checkUserRoleIsAtLeast(\EUserRole::NormalUser);
		
		$oUser = \Aurora\System\Api::getAuthenticatedUser();
		if ($oUser && $oUser->Role === \EUserRole::NormalUser)
		{
			if (isset($Args['AllowDesktopNotifications']))
			{
				$oUser->{$this->GetName().'::AllowDesktopNotifications'} = $Args['AllowDesktopNotifications'];
			}
			if (isset($Args['AutoRefreshIntervalMinutes']))
			{
				$oUser->{$this->GetName().'::AutoRefreshIntervalMinutes'} = $Args['AutoRefreshIntervalMinutes'];
			}
			if (isset($Args['Theme']))
			{
				$oUser->{$this->GetName().'::Theme'} = $Args['Theme'];
			}
			
			$oCoreDecorator = \Aurora\System\Api::GetModuleDecorator('Core');
			$oCoreDecorator->UpdateUserObject($oUser);
		}
	}
}
