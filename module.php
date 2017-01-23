<?php
/**
 * @copyright Copyright (c) 2016, Afterlogic Corp.
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

class CoreWebclientModule extends AApiModule
{
	/**
	 * Initializes CoreWebclient Module.
	 * 
	 * @ignore
	 */
	public function init() {
		$this->extendObject('CUser', array(
				'AutoRefreshIntervalMinutes'	=> array('int', 1),
				'Theme'							=> array('string', 'Default'),
				'AllowDesktopNotifications'		=> array('bool', false),
			)
		);
		
		$this->subscribeEvent('Core::UpdateSettings::after', array($this, 'onAfterUpdateSettings'));
	}
	
	public function GetSettings()
	{
		\CApi::checkUserRoleIsAtLeast(\EUserRole::Anonymous);
		
		$oUser = \CApi::getAuthenticatedUser();
		
		return array(
			'AutoRefreshIntervalMinutes' => $oUser ? $oUser->{$this->GetName().'::AutoRefreshIntervalMinutes'} : $this->getConfig('AutoRefreshIntervalMinutes', 1),
			'Theme' => $oUser ? $oUser->{$this->GetName().'::Theme'} : $this->getConfig('Theme', 'Default'),
			'AllowDesktopNotifications' => $oUser ? $oUser->{$this->GetName().'::AllowDesktopNotifications'} : $this->getConfig('AllowDesktopNotifications', false),
		);
	}
	
	public function onAfterUpdateSettings($Args, &$Result)
	{
		\CApi::checkUserRoleIsAtLeast(\EUserRole::NormalUser);
		
		$oUser = \CApi::getAuthenticatedUser();
		if ($oUser && $oUser->Role === \EUserRole::NormalUser)
		{
			$oCoreDecorator = \CApi::GetModuleDecorator('Core');
			$oUser->{$this->GetName().'::AutoRefreshIntervalMinutes'} = $Args['AutoRefreshIntervalMinutes'];
			$oUser->{$this->GetName().'::Theme'} = $Args['Theme'];
			$oUser->{$this->GetName().'::AllowDesktopNotifications'} = $Args['AllowDesktopNotifications'];
			$oCoreDecorator->UpdateUserObject($oUser);
		}
	}
}
